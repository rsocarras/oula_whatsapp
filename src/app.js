import express from 'express'
import sessionsRouter from './routes/sessions.js'
import messagesRouter from './routes/messages.js'
import { errorHandler } from './middleware/errorHandler.js'

export const createApp = () => {
  const app = express()
  
  app.use(express.json())
  
  // Health check
  app.get('/health', (req, res) => res.json({ ok: true }))
  
  // Routes
  app.use('/sessions', sessionsRouter)
  app.use('/sessions', messagesRouter)
  
  // Error handling
  app.use(errorHandler)
  
  return app
}