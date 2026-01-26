import { Router } from 'express'
import { sessionService } from '../services/sessionService.js'
import { auth } from '../middleware/auth.js'
import { validateMessage } from '../utils/validators.js'

const router = Router()

router.post('/:key/send-text', auth, async (req, res, next) => {
  try {
    const sessionKey = req.params.key
    const { to, text } = req.body || {}

    const validation = validateMessage(to, text)
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: validation.message 
      })
    }

    await sessionService.sendMessage(sessionKey, to, text)
    res.json({ ok: true })
    
  } catch (error) {
    if (error.message === 'Session not connected') {
      return res.status(409).json({ error: 'session_not_connected' })
    }
    next(error)
  }
})

export default router