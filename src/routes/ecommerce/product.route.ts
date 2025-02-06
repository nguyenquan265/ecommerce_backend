import { Router } from 'express'

import { authenticate, isAdmin } from '~/middlewares/ecommerce/auth.middleware'
import {
  createProduct,
  deleteAndRestoreProduct,
  getAllProducts,
  getProduct,
  updateProduct
} from '~/controllers/ecommerce/product.controller'

const router = Router()

router.get('/', getAllProducts)
router.post('/', authenticate, isAdmin, createProduct)
router.get('/admin', authenticate, getAllProducts)
router.get('/admin/:productId', authenticate, getProduct)
router.get('/:productId', getProduct)
router.patch('/:productId', authenticate, isAdmin, updateProduct)
router.delete('/:productId', authenticate, isAdmin, deleteAndRestoreProduct)

export default router
