import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
    // Load all env variables from the root directory, with no prefix
    const env = loadEnv(mode, process.cwd(), '')

    return {
        test: {
            env: { ...env, ...process.env },
        },
    }
})
