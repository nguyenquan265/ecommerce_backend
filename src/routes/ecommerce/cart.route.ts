import { Router } from 'express'

import { authenticate } from '~/middlewares/ecommerce/auth.middleware'
import { addToCart, getCart, removeFromCart, clearCart } from '~/controllers/ecommerce/cart.controller'

const router = Router()

router.get('/', authenticate, getCart)
router.post('/add', authenticate, addToCart)
router.delete('/remove/:productId', authenticate, removeFromCart)
router.delete('/clear', authenticate, clearCart)

export default router
