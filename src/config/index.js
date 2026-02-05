import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 8081,
  apiKey: process.env.API_KEY,
  authDir: './data/auth',
  logDir: './data/logs',
  
  // Session management
  maxSessions: parseInt(process.env.MAX_SESSIONS) || 1000,
  sessionTTL: parseInt(process.env.SESSION_TTL) || 1 * 1 * 1000, // 30 min
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 5, // 5 min
   
  // Recovery settings
  recoveryEnabled: process.env.RECOVERY_ENABLED !== 'false',
  recoveryTimeout: parseInt(process.env.RECOVERY_TIMEOUT) || 30000
}

if (!config.apiKey) {
  throw new Error('API_KEY is required in environment variables')
}