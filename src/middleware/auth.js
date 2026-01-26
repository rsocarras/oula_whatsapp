import { config } from '../config/index.js'

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  if (authHeader !== `Bearer ${config.apiKey}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
}