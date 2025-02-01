import { Router } from 'express'

import {} from '~/controllers/ecommerce/user.controller'
import { authenticate } from '~/middlewares/ecommerce/auth.middleware'

const router = Router()

export default router
