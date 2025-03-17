import { Router } from 'express'

import {
  addToWishlist,
  checkAuth,
  forgotPassword,
  login,
  loginWithGoogle,
  refreshToken,
  removeFromWishlist,
  resetPassword,
  signUp,
  updateMyPassword,
  updateMyProfile
} from '../../controllers/ecommerce/auth.controller'
import { authenticate } from '../../middlewares/ecommerce/auth.middleware'

const router = Router()

router.post('/sign-up', signUp)
router.post('/login', login)
router.post('/google-login', loginWithGoogle)
router.patch('/refresh-token', refreshToken)
router.get('/check-auth', authenticate, checkAuth)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)

router.patch('/me/update-profile', authenticate, updateMyProfile)
router.patch('/me/update-password', authenticate, updateMyPassword)
router.patch('/me/add-to-wishlist', authenticate, addToWishlist)
router.patch('/me/remove-from-wishlist', authenticate, removeFromWishlist)

export default router
