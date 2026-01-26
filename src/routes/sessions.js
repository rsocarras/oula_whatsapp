import { Router } from 'express'
import { sessionService } from '../services/sessionService.js'
import { auth } from '../middleware/auth.js'

const router = Router()

router.post('/:key/connect', auth, async (req, res, next) => {
  try {
    const sessionKey = req.params.key
    const session = await sessionService.ensureSession(sessionKey)
    
    res.json({ 
      status: session.status, 
      qr: session.lastQr 
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:key', auth, async (req, res, next) => {
  try {
    const sessionKey = req.params.key
    const session = await sessionService.ensureSession(sessionKey)
    
    const response = {
      status: session.status,
      phone: session.phone,
      qr: session.lastQr
    }
    
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify(response))
  } catch (error) {
    next(error)
  }
})

export default router