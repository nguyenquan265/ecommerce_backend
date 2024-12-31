import { Router } from 'express'

import { getProducts } from '~/controllers/ecommerce/product.controller'
import { authenticate } from '~/middlewares/ecommerce/auth.middleware'

const router = Router()

router.get('/', getProducts)

export default router
