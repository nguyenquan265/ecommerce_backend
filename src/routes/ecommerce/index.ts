import { Router } from 'express'

import userRouter from './user.route'
import productRouter from './product.route'

const router = Router()

router.use('/auth', userRouter)
router.use('/products', productRouter)

export default router
