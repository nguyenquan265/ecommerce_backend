import { Router } from 'express'

import { createUser, deleteUser, getAllUsers, getUser, updateUser } from '~/controllers/ecommerce/user.controller'
import { authenticate, isAdmin } from '~/middlewares/ecommerce/auth.middleware'

const router = Router()

router.get('/', getAllUsers)
router.post('/', authenticate, isAdmin, createUser)
router.get('/admin', authenticate, getAllUsers)
router.get('/admin/:userId', authenticate, getUser)
router.get('/:userId', getUser)
router.patch('/:userId', authenticate, isAdmin, updateUser)
router.delete('/:userId', authenticate, isAdmin, deleteUser)

export default router
