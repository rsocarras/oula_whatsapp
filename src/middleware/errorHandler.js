import { logger } from '../utils/logger.js'

export const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err)
  
  if (res.headersSent) {
    return next(err)
  }
  
  res.status(500).json({ 
    error: 'internal_server_error',
    message: err.message 
  })
}