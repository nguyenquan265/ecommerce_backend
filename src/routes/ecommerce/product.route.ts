import { Router } from 'express'

import { authenticate } from '~/middlewares/ecommerce/auth.middleware'
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProduct,
  updateProduct
} from '~/controllers/ecommerce/product.controller'

const router = Router()

router.get('/', getAllProducts)
router.post('/', authenticate, createProduct)
router.get('/admin', authenticate, getAllProducts)
router.get('/admin/:productId', authenticate, getProduct)
router.get('/:productId', getProduct)
router.patch('/:productId', authenticate, updateProduct)
router.delete('/:productId', authenticate, deleteProduct)

export default router
