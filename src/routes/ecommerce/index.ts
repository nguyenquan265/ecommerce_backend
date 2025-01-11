import { Router } from 'express'

import userRouter from './user.route'
import productRouter from './product.route'
import categoryRouter from './category.route'

const router = Router()

router.use('/auth', userRouter)
router.use('/products', productRouter)
router.use('/categories', categoryRouter)

export default router
