import express from 'express'
import cors from 'cors'
import { installLogCapture } from './log-capture'

// Install log capture before anything else so we intercept all mind-palace logs
process.env.MIND_PALACE_LOG_LEVEL = 'info'
installLogCapture()

import router from './routes'

const app = express()
const PORT = 3456

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(router)

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Mind Palace dev server running on http://localhost:${PORT}`)
})
