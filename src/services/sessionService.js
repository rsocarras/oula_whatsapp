import { WhatsAppService } from './whatsappService.js'
import { logger } from '../utils/logger.js'

class SessionService {
  constructor() {
    this.sessions = new Map()
  }

  async ensureSession(sessionKey) {
    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey)
    }

    const sock = await WhatsAppService.createSocket(sessionKey)
    
    const session = {
      sock,
      status: 'connecting',
      phone: null,
      lastQr: null,
      reconnectAttempts: 0
    }

    this.sessions.set(sessionKey, session)

    WhatsAppService.setupConnectionHandler(sock, sessionKey, (update) => {
      this.updateSession(sessionKey, update)
    })

    return session
  }

  updateSession(sessionKey, { status, qrCode, phone }) {
    const session = this.sessions.get(sessionKey)
    if (!session) return

    if (status) session.status = status
    if (qrCode) session.lastQr = qrCode
    if (phone) session.phone = phone

    this.sessions.set(sessionKey, session)
  }

  getSession(sessionKey) {
    return this.sessions.get(sessionKey)
  }

  async sendMessage(sessionKey, to, text) {
    const session = this.getSession(sessionKey)
    
    if (!session || !session.sock || session.status !== 'connected') {
      throw new Error('Session not connected')
    }

    const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`
    
    await session.sock.sendMessage(jid, { text })
    logger.info(`Message sent from ${sessionKey} to ${to}`)
  }
}

export const sessionService = new SessionService()