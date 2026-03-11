import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [ react() ],
    root: path.resolve(__dirname, 'client'),
    server: {
        port: 61000,
        proxy: {
            '/api': {
                target: 'http://localhost:62000',
                changeOrigin: true,
            },
        },
    },
})
