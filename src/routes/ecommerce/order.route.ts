import { Router } from 'express'

import { authenticate, isAdmin } from '../../middlewares/ecommerce/auth.middleware'
import {
  cancelOrder,
  createOrder,
  getAdminOrders,
  getOrderById,
  getMyOrders,
  momoCallback,
  zaloCallback,
  updateOrder,
  deleteOrder,
  getOrderOverview,
  getOrderShopOverview,
  confirmOrder
} from '../../controllers/ecommerce/order.controller'

const router = Router()

router.post('/zalo-callback', zaloCallback)
router.post('/momo-callback', momoCallback)
router.patch('/cancel-order/:orderId', authenticate, cancelOrder)
router.patch('/confirm-order/:orderId', authenticate, confirmOrder)

// crud
router.get('/', authenticate, getMyOrders)
router.post('/', authenticate, createOrder)
router.get('/admin', authenticate, isAdmin, getAdminOrders)
router.get('/overview', authenticate, isAdmin, getOrderOverview)
router.get('/shopOverview', authenticate, isAdmin, getOrderShopOverview)
router.get('/:orderId', authenticate, isAdmin, getOrderById)
router.patch('/:orderId', authenticate, isAdmin, updateOrder)
router.delete('/:orderId', authenticate, isAdmin, deleteOrder)

export default router
