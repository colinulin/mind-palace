import OpenAI from 'openai'
import { ContentBlock, GenerateInferenceParams, GenericMessage, StopReason, Tool } from './types'
import {
    ResponseCreateParamsNonStreaming,
    ResponseFormatTextJSONSchemaConfig,
    ResponseInputItem,
} from 'openai/resources/responses/responses.js'
import { zodResponseFormat } from 'openai/helpers/zod.js'
import { ZodType } from 'zod'
import { ILLM, LLM } from './llm'
import logger from '../logger'

/**
 * Class for interacting with the OpenAI API including chat completion and embedding generation
 */
export default class GPT extends LLM implements ILLM {
    embeddingModel = 'text-embedding-3-large'
    defaultRecallModel = 'gpt-5-mini'
    defaultRememberModel = 'gpt-5.4'
    private gptClient: OpenAI

    /**
     * Initialize OpenAI Client with the required API key and configuration.
     */
    constructor (config: { apiKey: string; embeddingModel?: string; generativeModel?: string }) {
        super()

        if (config.embeddingModel) {
            this.embeddingModel = config.embeddingModel
        }

        this.gptClient = new OpenAI({
            apiKey: config.apiKey,
            timeout: 15 * 1000, // 15 seconds
            maxRetries: 3,
        })
    }

    /**
     * Generate embedding
     */
    async generateEmbeddings (input: string | string[]) {
        const embeddingResponse = await this.gptClient.embeddings.create({
            input,
            model: this.embeddingModel,
            encoding_format: 'float',
        })

        logger.debug({ label: 'GPT', metadata: embeddingResponse })
        logger.info({ label: 'GPT', message: 'Embedding generation complete' })

        return { 
            embeddings: embeddingResponse.data,
            tokenUsage: {
                embeddingTokens: embeddingResponse.usage.total_tokens,
            },
            model: this.embeddingModel,
        }
    }

    /**
     * Convert generic message to GPT formatted message
     */
    protected createGPTMessages (messages: GenericMessage[]) {
        return messages.reduce((acc, m) => {
            if (typeof m.content === 'string') {
                acc.push({
                    role: m.role,
                    content: m.content,
                    type: 'message',
                })
            } else {
                m.content.forEach(c => {
                    if (c.type === 'text') {
                        acc.push({
                            role: m.role,
                            type: 'message',
                            content: c.text,
                        })
                    }
                    else if (c.type === 'tool_result' && typeof c.content === 'string') {
                        acc.push({
                            call_id: c.id,
                            output: c.content,
                            type: 'function_call_output',
                        })
                    }
                    else if (c.type === 'tool_use') {
                        acc.push({
                            arguments: JSON.stringify(c.input),
                            name: c.name,
                            call_id: c.id,
                            type: 'function_call',
                        })
                    }
                })
            }
            return acc
        }, new Array<ResponseInputItem>())
    }

    /**
     * Convert GPT formatted messages into generic content blocks
     */
    static createGenericContentBlocks (response: OpenAI.Responses.Response) {
        return response.output.reduce<ContentBlock[]>((acc, b) => {
            if (b.type === 'reasoning') {
                b.summary.forEach(s => {
                    acc.push({
                        type: 'thinking',
                        signature: b.id,
                        thinking: s.text,
                    })
                })
            }
            if (b.type === 'function_call') {
                acc.push({
                    type: 'tool_use',
                    input: JSON.parse(b.arguments),
                    name: b.name,
                    id: b.call_id,
                })
            }
            if (b.type === 'message') {
                if (typeof b.content === 'string') {
                    acc.push({
                        type: 'text',
                        text: b.content,
                        id: b.id,
                    })
                } else {
                    b.content.forEach(c => {
                        if (c.type === 'output_text') {
                            acc.push({
                                type: 'text',
                                text: c.text,
                                id: b.id,
                            })
                        }
                    })
                }
            }
            return acc
        }, [])
    }

    /**
     * Convert GPT input items into generic content blocks
     */
    static createGenericContentBlocksFromInput (
        input: ResponseCreateParamsNonStreaming['input'],
    ) {
        if (!input || typeof input === 'string') {
            return input ? [{ type: 'text' as const, text: input }] : []
        }

        return input.reduce<ContentBlock[]>((acc, item) => {
            if (item.type === 'message') {
                if (typeof item.content === 'string') {
                    acc.push({ type: 'text', text: item.content })
                } else {
                    item.content.forEach(c => {
                        if (c.type === 'input_text' || c.type === 'output_text') {
                            acc.push({ type: 'text', text: c.text })
                        }
                    })
                }
            }
            if (item.type === 'function_call') {
                acc.push({
                    type: 'tool_use',
                    input: JSON.parse(item.arguments),
                    name: item.name,
                    id: item.call_id,
                })
            }
            if (item.type === 'function_call_output') {
                acc.push({
                    type: 'tool_result',
                    id: item.call_id,
                    content: typeof item.output === 'string'
                        ? item.output
                        : item.output
                            .filter(c => c.type === 'input_text')
                            .map(c => ({ type: 'text' as const, text: c.text })),
                })
            }
            return acc
        }, [])
    }
    
    /**
     * Convert generic tools to GPT formatted tools
     */
    protected createGPTTools (tools: Tool[]) {
        return tools.map(t => ({
            name: t.name,
            description: t.description,
            type: 'function' as const,
            parameters: t.parameters,
            strict: !!t.strict,
        }))
    }

    /**
     * Generate inference
     */
    async generateInference<T extends Record<string, unknown>, U extends ZodType<T>> (
        params: GenerateInferenceParams<U>,
    ) {
        const {
            messages,
            model,
            systemMessage,
            responseSchema,
            tools,
            toolChoice,
            maxTokens,
            reasoningLevel,
        } = params
        const openaiResponseFormat = zodResponseFormat(responseSchema, 'format')

        const effort = reasoningLevel === 'off' ? 'minimal' : reasoningLevel || 'minimal'

        const responseCreateConfig: ResponseCreateParamsNonStreaming & { model: string } = {
            model,
            input: this.createGPTMessages(messages),
            instructions: systemMessage,
            max_output_tokens: maxTokens || 10000,
            tools: [],
            reasoning: { effort, summary: null },
            text: {
                format: {
                    ...openaiResponseFormat.json_schema as ResponseFormatTextJSONSchemaConfig,
                    type: openaiResponseFormat.type,
                },
            },
        }

        // if any tools are passed, convert them to the correct format and attach to response creation config
        if (tools?.length) {
            const gptTools = this.createGPTTools(tools)

            responseCreateConfig.tools?.push(...gptTools)
            responseCreateConfig.tool_choice = toolChoice === 'any'
                ? 'required'
                : toolChoice === 'none'
                    ? 'none'
                    : typeof toolChoice === 'object'
                        ? { type: 'function', name: toolChoice.name }
                        : 'auto'

            // if tools are included, remove response schema to greatly increase generation time
            delete responseCreateConfig.text
        }

        logger.info({ label: 'GPT', metadata: responseCreateConfig })

        const response = await this.gptClient.responses.create(responseCreateConfig)

        logger.info({ label: 'GPT', message: 'Reference generation complete' })
        logger.debug({ label: 'GPT', metadata: response })

        // convert response back to generic content blocks
        const responseContentBlocks = GPT.createGenericContentBlocks(response)

        // if last content block is text, then it's a structured response so 
        // convert JSON stringified version of structured output to JS object
        const lastContentBlock = responseContentBlocks[responseContentBlocks.length - 1]
        const structuredResponse = lastContentBlock.type === 'text'
            ? this.extractStructuredReturn(lastContentBlock, responseSchema)
            : null

        // if there are any function_calls in output, stopReason is tool_use
        const stopReason: StopReason = responseContentBlocks.some(m => m.type === 'tool_use')
            ? 'tool_use'
            : response.incomplete_details?.reason || 'end_turn'
    
        const completionReturn = {
            response: {
                contentBlocks: responseContentBlocks,
                stopReason,
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
