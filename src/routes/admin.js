import { Router } from 'express'
import { sessionService } from '../services/sessionService.js'
import { auth } from '../middleware/auth.js'

const router = Router()

router.get('/stats', auth, (req, res) => {
  const stats = sessionService.getStats()
  res.json(stats)
})

router.post('/cleanup', auth, (req, res) => {
  sessionService.performCleanup()
  res.json({ message: 'Cleanup performed' })
})

router.post('/recovery', auth, async (req, res) => {
  try {
    await sessionService.recoverSessions()
    res.json({ message: 'Recovery completed' })
  } catch (error) {
    res.status(500).json({ error: 'Recovery failed', message: error.message })
  }
})

export default router