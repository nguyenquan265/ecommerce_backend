import { Router } from 'express'

import { authenticate } from '../../middlewares/ecommerce/auth.middleware'
import { addToCart, getCart, removeFromCart, clearCart, updateCart } from '../../controllers/ecommerce/cart.controller'

const router = Router()

router.use(authenticate)
router.get('/', getCart)
router.post('/add', addToCart)
router.patch('/update', updateCart)
router.delete('/remove/:productId', removeFromCart)
router.delete('/clear', clearCart)

export default router
