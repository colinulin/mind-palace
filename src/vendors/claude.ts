import Anthropic from '@anthropic-ai/sdk'
import { ContentBlock, GenerateInferenceParams, GenericMessage, Tool } from './types'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { ZodType } from 'zod'
import { ILLM, LLM } from './llm'
import logger from '../logger'

export default class Claude extends LLM implements ILLM {
    private claudeClient: Anthropic
    generativeModel = 'claude-haiku-4-5'

    /**
     * Initialize Claude Client with the required API key and configuration.
     */
    constructor (config: { apiKey: string; model?: string }) {
        super()

        const { apiKey, model } = config

        if (model) {
            this.generativeModel = model
        }

        this.claudeClient = new Anthropic({
            apiKey,
            timeout: 15 * 1000, // 15 seconds
            maxRetries: 3,
        })
    }

    /**
     * Convert generic tools to Claude formatted tools
     */
    protected createClaudeTools (tools: Tool[]) {
        return tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
        }))
    }

    /**
     * Convert generic content blocks to Claude formatted message
     */
    protected createClaudeMessages (messages: GenericMessage[]) {
        return messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string'
                ? m.content
                : m.content.map(c => {
                    if (c.type === 'tool_result') {
                        return {
                            type: c.type,
                            tool_use_id: c.id,
                            content: c.content,
                        }
                    }

                    return c
                }),
        }))
    }

    /**
     * Convert Claude formatted messages into generic content blocks
     */
    static createGenericContentBlocks (response: Anthropic.Beta.Messages.BetaMessage | Anthropic.Messages.Message) {
        return response.content.reduce<ContentBlock[]>((acc, b) => {
            if (b.type === 'thinking') {
                acc.push({
                    type: 'thinking',
                    signature: b.signature,
                    thinking: b.thinking,
                })
            }
            if (b.type === 'tool_use') {
                acc.push({
                    type: 'tool_use',
                    input: typeof b.input === 'string'
                        ? JSON.parse(b.input || '{}')
                        : b.input as Record<string, unknown>,
                    name: b.name,
                    id: b.id,
                })
            }
            if (b.type === 'text') {
                acc.push({
                    type: 'text',
                    text: b.text,
                })
            }
            return acc
        }, [])
    }

    /**
     * Convert Claude input message params into generic content blocks
     */
    static createGenericContentBlocksFromInput (
        messages: Anthropic.Beta.Messages.BetaMessageParam[] | Anthropic.Messages.MessageParam[],
    ) {
        return messages.flatMap<ContentBlock>(m => {
            if (typeof m.content === 'string') {
                return [{ type: 'text', text: m.content }]
            }

            return m.content.reduce<ContentBlock[]>((acc, b) => {
                if (b.type === 'thinking') {
                    acc.push({
                        type: 'thinking',
                        signature: b.signature,
                        thinking: b.thinking,
                    })
                }
                if (b.type === 'tool_use') {
                    acc.push({
                        type: 'tool_use',
                        input: typeof b.input === 'string'
                            ? JSON.parse(b.input || '{}')
                            : b.input as Record<string, unknown>,
                        name: b.name,
                        id: b.id,
                    })
                }
                if (b.type === 'tool_result') {
                    acc.push({
                        type: 'tool_result',
                        id: b.tool_use_id,
                        content: typeof b.content === 'string'
                            ? b.content
                            : (b.content || [])
                                .filter((c): c is Anthropic.Messages.TextBlockParam => c.type === 'text')
                                .map(c => ({ type: 'text' as const, text: c.text })),
                    })
                }
                if (b.type === 'text') {
                    acc.push({ type: 'text', text: b.text })
                }
                return acc
            }, [])
        })
    }

    /**
     * Generate inference
     */
    async generateInference<T extends Record<string, unknown>, U extends ZodType<T>> (
        params: GenerateInferenceParams<U>,
    ) {
        const {
            messages,
            model: customModel,
            systemMessage,
            responseSchema,
            tools,
            toolChoice,
            maxTokens,
        } = params
        const model = customModel || this.generativeModel

        // configure inference generation
        const inferenceParams: Anthropic.Beta.MessageCreateParamsNonStreaming = {
            model,
            messages: this.createClaudeMessages(messages),
            max_tokens: maxTokens || 1000,
            system: systemMessage,
            betas: [ 'structured-outputs-2025-11-13' ],
            output_format: betaZodOutputFormat(responseSchema),
        }

        // if any tools are passed, convert them to the correct format and attach to response creation config
        if (tools) {
            const claudeTools = this.createClaudeTools(tools)
            inferenceParams.tools = claudeTools

            if (toolChoice) {
                inferenceParams.tool_choice = typeof toolChoice === 'object'
                    ? { 
                        type: 'tool', 
                        name: toolChoice.name,
                        disable_parallel_tool_use: true,
                    }
                    : {
                        type: toolChoice,
                        disable_parallel_tool_use: true,
                    }
            }

            // if tools are included, remove response schema to greatly increase generation time
            delete inferenceParams.output_format
        }

        logger.info({ label: 'Claude', metadata: inferenceParams })

        const response = await this.claudeClient.beta.messages.create(inferenceParams)

        logger.info({ label: 'Claude', message: 'Reference generation complete' })
        logger.debug({ label: 'Claude', metadata: response })

        // convert response back to generic content blocks
        const responseContentBlocks = Claude.createGenericContentBlocks(response)

        // if last message is text, then it's a structured response so 
        // convert JSON stringified version of structured output to JS object
        const lastContentBlock = responseContentBlocks[responseContentBlocks.length - 1]
        const structuredResponse = lastContentBlock.type === 'text' 
            ? this.extractStructuredReturn(lastContentBlock, responseSchema)
            : null

        const completionReturn = {
            response: {
                contentBlocks: responseContentBlocks,
                stopReason: response.stop_reason,
            },
            structuredResponse,
            tokenUsage: {
                input: response.usage?.input_tokens || 0,
                output: response.usage?.output_tokens || 0,
            },
            model,
        }

        return completionReturn
    }
}
