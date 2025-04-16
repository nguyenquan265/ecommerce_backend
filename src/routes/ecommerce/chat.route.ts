import { Router } from 'express'

import { getChatInformation } from '~/controllers/ecommerce/chat.controller'

const router = Router()

router.get('/', getChatInformation)

export default router
