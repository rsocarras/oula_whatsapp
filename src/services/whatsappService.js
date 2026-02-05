import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

export class WhatsAppService {
  static async createSocket(sessionKey) {
    const { state, saveCreds } = await useMultiFileAuthState(`${config.authDir}/${sessionKey}`)

    const sock = makeWASocket({
      auth: state,
      // browser: ['Oula Gateway', 'Chrome', '10.15.7'],
      // markOnlineOnConnect: false,
      // syncFullHistory: false,
      // logger: logger.child({ level: 'error' })
    })

    sock.ev.on('creds.update', saveCreds)
    
    return sock
  }

  static async generateQR(qrData) {
    return await qrcode.toDataURL(qrData)
  }

  static setupConnectionHandler(sock, sessionKey, onUpdate, onReconnect) {
    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update
      
      logger.info(`Connection update for ${sessionKey}: ${connection}`)
      
      let status = null
      let qrCode = null
      let phone = null
      let shouldReconnect = false

      if (qr) {
        qrCode = await this.generateQR(qr)
        status = 'qr_pending'
        logger.info(`QR updated for ${sessionKey}`)
      }

      if (connection === 'open') {
        status = 'connected'
        phone = sock.user?.id || null
        logger.info(`Connected ${sessionKey}, phone: ${phone}`)
      }

      if (connection === 'close') {
        status = 'disconnected'
        console.log(`-------------------------------------- Disconnected ${JSON.stringify(lastDisconnect)}`)
        shouldReconnect = lastDisconnect?.error?.output?.statusCode == 515
        logger.warn(`Disconnected ${sessionKey}, should reconnect: ${shouldReconnect}`)
        
        if (shouldReconnect && onReconnect) {
          setTimeout(() => {
            logger.info(`Checking if should reconnect ${sessionKey}`)
            onReconnect(sessionKey)
          }, 1000)
        }
      }

      if (onUpdate) {
        onUpdate({ status, qrCode, phone, connection, lastDisconnect, shouldReconnect })
      }
    })
  }
}