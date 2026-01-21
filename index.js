import express from 'express'
import dotenv from 'dotenv'
import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'

dotenv.config()
const app = express()
app.use(express.json())

// sessions: sessionKey -> { sock, status, phone, lastQr }
const sessions = new Map()

function auth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  if (authHeader !== `Bearer ${process.env.API_KEY}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
}

app.get('/health', (req, res) => res.json({ ok: true }))

async function ensureSession(sessionKey) {
  // ya existe
  if (sessions.has(sessionKey)) return sessions.get(sessionKey)

  const { state, saveCreds } = await useMultiFileAuthState(`./auth/${sessionKey}`)

  const sock = makeWASocket({
    auth: state,
    // ✅ no usar printQRInTerminal
  })

  sock.ev.on('creds.update', saveCreds)

  const sess = { sock, status: 'qr_pending', phone: null, lastQr: null }
  sessions.set(sessionKey, sess)

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update
    const s = sessions.get(sessionKey)

    if (qr) {
      s.lastQr = await qrcode.toDataURL(qr)
      s.status = 'qr_pending'
      sessions.set(sessionKey, s)
      console.log('✅ QR actualizado para', sessionKey)
    }

    if (connection === 'open') {
      s.status = 'connected'
      s.phone = sock.user?.id || null
      sessions.set(sessionKey, s)
      console.log('✅ Conectado', sessionKey, 'phone:', s.phone)
    }

    if (connection === 'close') {
      s.status = 'disconnected'
      sessions.set(sessionKey, s)
      console.log('⚠️ Desconectado', sessionKey)
    }
  })

  return sess
}

// CONNECT: crea sesión y devuelve el QR si ya existe
app.post('/sessions/:key/connect', auth, async (req, res) => {
  const sessionKey = req.params.key
  const s = await ensureSession(sessionKey)

  // puede que el QR llegue milisegundos después
  res.json({ status: s.status, qr: s.lastQr })
})

// STATUS: devuelve status + QR + phone
app.get('/sessions/:key', auth, async (req, res) => {
  const sessionKey = req.params.key
  const s = await ensureSession(sessionKey)
  
  res.json({
    status: s.status,
    phone: s.phone,
    qr: s.lastQr
  })
})


// Enviar mensaje 

app.listen(process.env.PORT || 8081, () => {
  console.log(`🚀 WA Gateway running on ${process.env.PORT || 8081}`)
})

// SEND TEXT
app.post('/sessions/:key/send-text', auth, async (req, res) => {
  const sessionKey = req.params.key
  const { to, text } = req.body || {}

  if (!to || !text) {
    return res.status(400).json({ error: 'to_and_text_required' })
  }

  const s = sessions.get(sessionKey)
  if (!s || !s.sock || s.status !== 'connected') {
    return res.status(409).json({ error: 'session_not_connected' })
  }

  try {
    // normaliza destino a JID
    const jid = to.includes('@')
      ? to
      : `${to.replace(/\D/g, '')}@s.whatsapp.net`

    await s.sock.sendMessage(jid, { text })
    return res.json({ ok: true })
  } catch (e) {
    console.error('send-text error', e)
    return res.status(500).json({ error: 'send_failed' })
  }
})

