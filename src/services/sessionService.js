import { WhatsAppService } from './whatsappService.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'
import { LRUCache } from 'lru-cache'
import cron from 'node-cron'
import fs from 'fs'
import path from 'path'

class SessionService {
  constructor() {
    // Configurar dispose callback para desactivar reconexión
    this.sessions = new LRUCache({
      max: config.maxSessions,
      ttl: config.sessionTTL,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: (session, sessionKey) => {
        logger.info(`Session ${sessionKey} removed from cache`)
        if (session?.sock) {
          // Desactivar reconexión antes de cerrar
          session.allowReconnect = false
          session.sock.end()
        }
      }
    })

    // Iniciar cleanup automático
    this.startCleanupJob()
    
    // Auto-recovery al iniciar
    if (config.recoveryEnabled) {
      setTimeout(() => this.recoverSessions(), config.recoveryTimeout)
    }
  }

  async ensureSession(sessionKey) {
    // Buscar en cache
    let session = this.sessions.get(sessionKey)
    if (session) {
      this.updateLastActivity(sessionKey)
      return session
    }

    // No está en cache, intentar cargar desde archivos auth
    return await this.loadOrCreateSession(sessionKey)
  }

  async loadOrCreateSession(sessionKey) {
    const authPath = path.join(config.authDir, sessionKey)
    const hasExistingAuth = fs.existsSync(authPath)
    
    if (hasExistingAuth) {
      logger.info(`Loading existing session: ${sessionKey}`)
    } else {
      logger.info(`Creating new session: ${sessionKey}`)
    }

    try {
      return await this.createSession(sessionKey)
    } catch (error) {
      if (hasExistingAuth) {
        logger.error(`Failed to load session ${sessionKey}:`, error)
      }
      throw error
    }
  }

  async createSession(sessionKey) {
    const sock = await WhatsAppService.createSocket(sessionKey)
    
    const session = {
      sock,
      status: 'connecting',
      phone: null,
      lastQr: null,
      reconnectAttempts: 0,
      lastActivity: Date.now(),
      allowReconnect: true  // Flag para controlar reconexión
    }

    // Configurar handlers
    WhatsAppService.setupConnectionHandler(
      sock, 
      sessionKey, 
      (update) => this.updateSession(sessionKey, update),
      (sessionKey) => this.handleReconnectRequest(sessionKey)
    )

    // Agregar al cache
    this.sessions.set(sessionKey, session)
    return session
  }

  updateSession(sessionKey, { status, qrCode, phone, shouldReconnect }) {
    const session = this.sessions.get(sessionKey)
    if (!session) return

    if (status) session.status = status
    if (qrCode) session.lastQr = qrCode
    if (phone) {
      session.phone = phone
      session.reconnectAttempts = 0
    }
    
    session.lastActivity = Date.now()
    this.sessions.set(sessionKey, session)
  }

  updateLastActivity(sessionKey) {
    const session = this.sessions.get(sessionKey)
    if (session) {
      session.lastActivity = Date.now()
      this.sessions.set(sessionKey, session)
    }
  }

  // Nuevo método para manejar requests de reconexión
  handleReconnectRequest(sessionKey) {
    const session = this.sessions.get(sessionKey)
    
    // Verificar si la sesión aún existe y permite reconexión
    if (!session) {
      logger.info(`Session ${sessionKey} no longer exists, skipping reconnection`)
      return
    }
    
    if (!session.allowReconnect) {
      logger.info(`Session ${sessionKey} reconnection disabled, skipping`)
      return
    }
    
    // Proceder con reconexión
    this.reconnectSession(sessionKey)
  }

  async reconnectSession(sessionKey) {
    const session = this.sessions.get(sessionKey)
    if (!session) return

    if (session.reconnectAttempts >= 3) {
      logger.error(`Max reconnection attempts reached for ${sessionKey}`)
      session.allowReconnect = false
      return
    }

    session.reconnectAttempts++
    logger.info(`Reconnecting ${sessionKey}, attempt ${session.reconnectAttempts}/3`)
    
    setTimeout(async () => {
      try {
        await this.createSession(sessionKey)
      } catch (error) {
        logger.error(`Reconnection failed for ${sessionKey}:`, error)
      }
    }, 5000)
  }

  getSession(sessionKey) {
    const session = this.sessions.get(sessionKey)
    if (session) {
      this.updateLastActivity(sessionKey)
    }
    return session
  }

  async sendMessage(sessionKey, to, text) {
    const session = await this.ensureSession(sessionKey)
    
    if (!session || !session.sock || session.status !== 'connected') {
      throw new Error('Session not connected')
    }

    const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`
    
    await session.sock.sendMessage(jid, { text })
    this.updateLastActivity(sessionKey)
    logger.info(`Message sent from ${sessionKey} to ${to}`)
  }

  // Recovery de sesiones al iniciar
  async recoverSessions() {
    try {
      logger.info('Starting session recovery...')
      
      // Buscar todas las carpetas de auth existentes
      const authDir = config.authDir
      if (!fs.existsSync(authDir)) {
        logger.info('No auth directory found, skipping recovery')
        return
      }

      const sessionDirs = fs.readdirSync(authDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      logger.info(`Found ${sessionDirs.length} potential sessions to recover`)

      // Recuperar sesiones en paralelo (máximo 10 a la vez)
      const batchSize = 10
      for (let i = 0; i < sessionDirs.length; i += batchSize) {
        const batch = sessionDirs.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(sessionKey => this.recoverSingleSession(sessionKey))
        )
        
        // Pequeña pausa entre batches
        if (i + batchSize < sessionDirs.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      logger.info(`Recovery completed. Active sessions: ${this.sessions.size}`)
    } catch (error) {
      logger.error('Session recovery failed:', error)
    }
  }

  async recoverSingleSession(sessionKey) {
    try {
      // Verificar que tenga archivos válidos
      const authPath = path.join(config.authDir, sessionKey)
      const credsPath = path.join(authPath, 'creds.json')
      
      if (!fs.existsSync(credsPath)) {
        logger.warn(`No creds.json found for ${sessionKey}, skipping`)
        return
      }

      // Intentar cargar la sesión
      await this.createSession(sessionKey)
      logger.info(`Recovered session: ${sessionKey}`)
    } catch (error) {
      logger.warn(`Failed to recover session ${sessionKey}:`, error.message)
    }
  }

  // Cleanup automático
  startCleanupJob() {
    const cleanupInterval = config.cleanupInterval;
    // Ejecutar cada cleanupInterval minutos
    cron.schedule('*/'+cleanupInterval+' * * * *', () => {
      logger.info('Cleanup job rinning....')
      this.performCleanup()
    })
    
    logger.info('Cleanup job started (every '+cleanupInterval+' minutes)')
  }

  performCleanup() {
    const beforeSize = this.sessions.size
    const now = Date.now()
    const expiredSessions = []

    // Identificar sesiones expiradas
    for (const [sessionKey, session] of this.sessions.entries()) {
      const timeSinceActivity = now - (session.lastActivity || 0)
      logger.info('timeSinceActivity for '+sessionKey+': '+timeSinceActivity+' ms comparado con '+config.sessionTTL)
      if (timeSinceActivity > config.sessionTTL) {
        expiredSessions.push(sessionKey)
      }
    }

    // Desactivar reconexión y eliminar sesiones expiradas
    expiredSessions.forEach(sessionKey => {
      const session = this.sessions.get(sessionKey)
      if (session) {
        session.allowReconnect = false
      }
      this.sessions.delete(sessionKey)
    })

    const afterSize = this.sessions.size
    const cleaned = beforeSize - afterSize

    if (cleaned > 0) {
      logger.info(`Cleanup completed: removed ${cleaned} inactive sessions. Active: ${afterSize}`)
    }
  }

  // Métricas
  getStats() {
    return {
      activeSessions: this.sessions.size,
      maxSessions: config.maxSessions,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  }
}

export const sessionService = new SessionService()