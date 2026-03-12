import { useState, useEffect, useRef, useCallback } from 'react'

const DEBOUNCE_MS = 2000

export const usePersistedState = (key: string, defaultValue = '') => {
    const [ value, setValue ] = useState(() => {
        const stored = localStorage.getItem(key)
        return stored ?? defaultValue
    })
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            localStorage.setItem(key, value)
        }, DEBOUNCE_MS)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [ key, value ])

    const setValueWrapped = useCallback((newValue: string) => {
        setValue(newValue)
    }, [])

    return [ value, setValueWrapped ] as const
}
