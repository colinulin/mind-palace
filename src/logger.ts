/* eslint-disable no-console */
import { LogLevel, LogType } from './types'

const logLevel = (process.env.MIND_PALACE_LOG_LEVEL as LogLevel | undefined) || 'off'
type LogParams = { 
    message?: string
    label: string
    metadata?: unknown
}

/**
 * Logger helper function
 */
const logger = (type: LogType, params: LogParams) => {
    const { message, label, metadata } = params
    const formattedMetadata = JSON.stringify(metadata, null, 2)
    const logData = [ type, label.toUpperCase, message, formattedMetadata ]

    if (logLevel === 'off') {
        return
    }

    if (type === 'info' && (logLevel === 'debug' || logLevel === 'info')) {
        console.log(...logData)
    }

    if (type === 'warn' && (logLevel === 'debug' || logLevel === 'info')) {
        console.warn(...logData)
    }

    if (type === 'debug' && logLevel === 'debug') {
        console.log(...logData)
    }
    
    if (type === 'error') {
        console.error(...logData)
    }
}

export default {
    logger,
    info: (params: LogParams) => logger('info', params),
    warn: (params: LogParams) => logger('warn', params),
    error: (params: LogParams) => logger('error', params),
    debug: (params: LogParams) => logger('debug', params),
}
