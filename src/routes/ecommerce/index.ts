import { Router } from 'express'

import authRouter from './auth.route'
import userRouter from './user.route'
import productRouter from './product.route'
import categoryRouter from './category.route'
import cartRouter from './cart.route'
import orderRouter from './order.route'
import ChatBotRoute from './chat.route'

const router = Router()

router.use('/auth', authRouter)
router.use('/users', userRouter)
router.use('/products', productRouter)
router.use('/categories', categoryRouter)
router.use('/cart', cartRouter)
router.use('/orders', orderRouter)
router.use('/chat', ChatBotRoute)

export default router
