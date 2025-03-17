import { Router } from 'express'

import { authenticate, isAdmin } from '../../middlewares/ecommerce/auth.middleware'
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  updateCategory
} from '../../controllers/ecommerce/category.controller'

const router = Router()

router.get('/', getAllCategories)
router.post('/', authenticate, isAdmin, createCategory)
router.get('/:categoryId', getCategory)
router.patch('/:categoryId', authenticate, isAdmin, updateCategory)
router.delete('/:categoryId', authenticate, isAdmin, deleteCategory)

export default router
