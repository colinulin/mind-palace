import {
    GoogleGenAI,
    FunctionCallingConfigMode,
    Content,
    FunctionDeclaration,
    GenerateContentResponse,
    GenerateContentParameters,
    ThinkingLevel,
} from '@google/genai'
import { ZodType, toJSONSchema } from 'zod'
import { ContentBlock, GenerateInferenceParams, GenericMessage, StopReason, Tool } from './types'
import { ILLM, LLM } from './llm'
import logger from '../logger'

export default class Gemini extends LLM implements ILLM {
    private geminiClient: GoogleGenAI
    generativeModel = 'gemini-3-flash-preview'

    /**
     * Initialize Gemini Client with the required API key and configuration.
     */
    constructor (config: { apiKey: string; model?: string }) {
        super()

        const { apiKey, model } = config

        if (model) {
            this.generativeModel = model
        }

        this.geminiClient = new GoogleGenAI({
            apiKey,
            httpOptions: {
                timeout: 15 * 1000, // 15 seconds
                retryOptions: {
                    attempts: 3,
                },
            },
        })
    }

    /**
     * Convert generic tools to Gemini function declarations
     */
    protected createGeminiTools (tools: Tool[]): FunctionDeclaration[] {
        return tools.map(t => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: t.parameters,
        }))
    }

    /**
     * Convert generic messages to Gemini Content format
     */
    protected createGeminiContents (messages: GenericMessage[]): Content[] {
        return messages.reduce<Content[]>((acc, m) => {
            if (typeof m.content === 'string') {
                acc.push({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                })
            } else {
                const parts = m.content.reduce<NonNullable<Content['parts']>>((partAcc, c) => {
                    if (c.type === 'text') {
                        partAcc.push({ text: c.text })
                    } else if (c.type === 'tool_use') {
                        partAcc.push({
                            functionCall: {
                                name: c.name,
                                args: c.input,
                                id: c.id,
                            },
                        })
                    } else if (c.type === 'tool_result') {
                        const result = typeof c.content === 'string'
                            ? c.content
                            : JSON.stringify(c.content)
                        partAcc.push({
                            functionResponse: {
                                name: c.id,
                                id: c.id,
                                response: { result },
                            },
                        })
                    }
                    return partAcc
                }, [])

                acc.push({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts,
                })
            }
            return acc
        }, [])
    }

    /**
     * Convert Gemini response into generic content blocks
     */
    static createGenericContentBlocks (response: GenerateContentResponse) {
        const parts = response.candidates?.[0]?.content?.parts || []

        return parts.reduce<ContentBlock[]>((acc, part) => {
            if (part.thought && part.text) {
                acc.push({
                    type: 'thinking',
                    signature: part.thoughtSignature || '',
                    thinking: part.text,
                })
            } else if (part.functionCall) {
                if (!part.functionCall.name || !part.functionCall.id) {
                    return acc
                }

                acc.push({
                    type: 'tool_use',
                    name: part.functionCall.name,
                    id: part.functionCall.id,
                    input: part.functionCall.args || {},
                })
            } else if (part.text) {
                acc.push({
                    type: 'text',
                    text: part.text,
                })
            }
            return acc
        }, [])
    }

    /**
     * Convert Gemini input Content array into generic content blocks
     */
    static createGenericContentBlocksFromInput (contents: Content[]) {
        return contents.flatMap<ContentBlock>(content => {
            const parts = content.parts || []

            return parts.reduce<ContentBlock[]>((acc, part) => {
                if (part.thought && part.text) {
                    acc.push({
                        type: 'thinking',
                        signature: part.thoughtSignature || '',
                        thinking: part.text,
                    })
                } else if (part.functionCall) {
                    if (part.functionCall.name && part.functionCall.id) {
                        acc.push({
                            type: 'tool_use',
                            name: part.functionCall.name,
                            id: part.functionCall.id,
                            input: part.functionCall.args || {},
                        })
                    }
                } else if (part.functionResponse) {
                    if (part.functionResponse.id) {
                        acc.push({
                            type: 'tool_result',
                            id: part.functionResponse.id,
                            content: JSON.stringify(part.functionResponse.response),
                        })
                    }
                } else if (part.text) {
                    acc.push({ type: 'text', text: part.text })
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

        const config: Parameters<typeof this.geminiClient.models.generateContent>[0]['config'] = {
            systemInstruction: systemMessage,
            responseMimeType: 'application/json',
            responseJsonSchema: toJSONSchema(responseSchema),
            maxOutputTokens: maxTokens || 1000,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        }

        // if any tools are passed, convert them and attach to config
        if (tools?.length) {
            const geminiTools = this.createGeminiTools(tools)
            config.tools = [{ functionDeclarations: geminiTools }]

            // remove structured output when tools are present since Gemini
            // doesn't support both simultaneously
            delete config.responseMimeType
            delete config.responseJsonSchema

            if (toolChoice) {
                const mode = toolChoice === 'any'
                    ? FunctionCallingConfigMode.ANY
                    : toolChoice === 'none'
                        ? FunctionCallingConfigMode.NONE
                        : typeof toolChoice === 'object'
                            ? FunctionCallingConfigMode.ANY
                            : FunctionCallingConfigMode.AUTO

                config.toolConfig = {
                    functionCallingConfig: {
                        mode,
                        ...(typeof toolChoice === 'object'
                            ? { allowedFunctionNames: [ toolChoice.name ] }
                            : {}),
                    },
                }
            }

            // if tools are included, remove response schema to greatly increase generation time
            delete config.responseJsonSchema
        }

        const generateContentParams: GenerateContentParameters = {
            model,
            contents: this.createGeminiContents(messages),
            config,
        }

        logger.info({ label: 'Gemini', metadata: generateContentParams })

        const response = await this.geminiClient.models.generateContent(generateContentParams)

        logger.info({ label: 'Gemini', message: 'Reference generation complete' })
        logger.debug({ label: 'Gemini', metadata: response })

        // convert response back to generic content blocks
        const responseContentBlocks = Gemini.createGenericContentBlocks(response)

        // if last content block is text, then it's a structured response
        const lastContentBlock = responseContentBlocks[responseContentBlocks.length - 1]
        const structuredResponse = lastContentBlock?.type === 'text'
            ? this.extractStructuredReturn(lastContentBlock, responseSchema)
            : null

        // determine stop reason
        const stopReason: StopReason = responseContentBlocks.some(m => m.type === 'tool_use')
            ? 'tool_use'
            : response.candidates?.[0]?.finishReason?.toLowerCase() || 'end_turn'

        const completionReturn = {
            response: {
                contentBlocks: responseContentBlocks,
                stopReason,
            },
            structuredResponse,
            tokenUsage: {
                input: response.usageMetadata?.promptTokenCount || 0,
                output: response.usageMetadata?.candidatesTokenCount || 0,
            },
            model,
        }

        return completionReturn
    }
}
