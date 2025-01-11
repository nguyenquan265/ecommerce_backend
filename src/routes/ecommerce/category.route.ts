import { Router } from 'express'

import { authenticate } from '~/middlewares/ecommerce/auth.middleware'
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  updateCategory
} from '~/controllers/ecommerce/category.controller'

const router = Router()

router.get('/', getAllCategories)
router.post('/', authenticate, createCategory)
router.get('/:categoryId', getCategory)
router.patch('/:categoryId', authenticate, updateCategory)
router.delete('/:categoryId', authenticate, deleteCategory)

export default router
