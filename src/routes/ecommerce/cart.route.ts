import { Router } from 'express'

import { authenticate } from '~/middlewares/ecommerce/auth.middleware'
import { addToCart, getCart, removeFromCart } from '~/controllers/ecommerce/cart.controller'

const router = Router()

router.get('/', authenticate, getCart)
router.post('/items', authenticate, addToCart)
router.delete('/items/:productId', authenticate, removeFromCart)

export default router
