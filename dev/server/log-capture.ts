/* eslint-disable no-console */
export type CapturedLog = {
    timestamp: number
    level: string
    label: string
    message: string
    metadata?: unknown
}

const MAX_BUFFER_SIZE = 500
const logBuffer: CapturedLog[] = []

const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
}

const parseLogArgs = (level: string, args: unknown[]): CapturedLog | null => {
    // mind-palace logger outputs: [type, LABEL, message, metadata]
    if (args.length < 2 || typeof args[0] !== 'string' || typeof args[1] !== 'string') {
        return null
    }

    return {
        timestamp: Date.now(),
        level,
        label: String(args[1]),
        message: String(args[2] ?? ''),
        metadata: args[3] ? JSON.parse(String(args[3])) : undefined,
    }
}

const pushLog = (entry: CapturedLog) => {
    logBuffer.push(entry)
    if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE)
    }
}

export const installLogCapture = () => {
    console.log = (...args: unknown[]) => {
        originalConsole.log(...args)
        const entry = parseLogArgs('info', args)
        if (entry) pushLog(entry)
    }

    console.warn = (...args: unknown[]) => {
        originalConsole.warn(...args)
        const entry = parseLogArgs('warn', args)
        if (entry) pushLog(entry)
    }

    console.error = (...args: unknown[]) => {
        originalConsole.error(...args)
        const entry = parseLogArgs('error', args)
        if (entry) pushLog(entry)
    }
}

export const getLogsSince = (since: number) =>
    logBuffer.filter(entry => entry.timestamp > since)

export const getAllLogs = () => [ ...logBuffer ]

export const clearLogs = () => {
    logBuffer.length = 0
}

export const markCheckpoint = () => Date.now()
