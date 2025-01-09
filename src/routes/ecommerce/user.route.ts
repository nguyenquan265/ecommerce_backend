import { Router } from 'express'

import {
  checkAuth,
  login,
  loginWithGoogle,
  refreshToken,
  signUp,
  updateMyPassword,
  updateMyProfile,
  updateUser
} from '~/controllers/ecommerce/user.controller'
import { authenticate } from '~/middlewares/ecommerce/auth.middleware'

const router = Router()

router.post('/sign-up', signUp)
router.post('/login', login)
router.post('/google-login', loginWithGoogle)
router.patch('/refresh-token', refreshToken)

router.get('/check-auth', authenticate, checkAuth)
router.patch('/update-user', authenticate, updateUser)
router.patch('/me/update-profile', authenticate, updateMyProfile)
router.patch('/me/update-password', authenticate, updateMyPassword)

export default router
