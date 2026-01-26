import { createApp } from './src/app.js'
import { config } from './src/config/index.js'
import { logger } from './src/utils/logger.js'

const app = createApp()

app.listen(config.port, () => {
  logger.info(`🚀 WA Gateway running on port ${config.port}`)
})