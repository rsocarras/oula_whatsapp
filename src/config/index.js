import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 8081,
  apiKey: process.env.API_KEY,
  authDir: './data/auth',
  logDir: './data/logs'
}

if (!config.apiKey) {
  throw new Error('API_KEY is required in environment variables')
}