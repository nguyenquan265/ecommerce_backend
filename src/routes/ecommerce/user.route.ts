import { Router } from 'express'

import {
  checkAuth,
  login,
  loginWithGoogle,
  logout,
  refreshToken,
  signUp,
  updateProfile
} from '~/controllers/ecommerce/user.controller'
import { authenticate } from '~/middlewares/ecommerce/auth.middleware'

const router = Router()

router.post('/sign-up', signUp)
router.post('/login', login)
router.post('/google-login', loginWithGoogle)
router.post('/logout', logout)
router.post('/refresh-token', refreshToken)

router.get('/check-auth', authenticate, checkAuth)
router.patch('/update-profile', authenticate, updateProfile)

export default router
