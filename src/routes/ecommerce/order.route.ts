import { Router } from 'express'

import { authenticate, isAdmin } from '~/middlewares/ecommerce/auth.middleware'
import {
  cancelOrder,
  createOrder,
  getAdminOrders,
  getOrderById,
  getMyOrders,
  momoCallback,
  sepayCallback,
  zaloCallback,
  updateOrder,
  deleteOrder
} from '~/controllers/ecommerce/order.controller'

const router = Router()

router.post('/zalo-callback', zaloCallback)
router.post('/momo-callback', momoCallback)
router.post('/sepay-callback', sepayCallback)
router.patch('/cancel-order/:orderId', authenticate, cancelOrder)

// crud
router.get('/', authenticate, getMyOrders)
router.post('/', authenticate, createOrder)
router.get('/admin', authenticate, isAdmin, getAdminOrders)
router.get('/:orderId', authenticate, isAdmin, getOrderById)
router.patch('/:orderId', authenticate, isAdmin, updateOrder)
router.delete('/:orderId', authenticate, isAdmin, deleteOrder)

export default router
