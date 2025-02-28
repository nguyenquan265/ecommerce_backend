import { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import moment from 'moment'
import crypto from 'crypto'

import ZaloConfig from '~/config/ecommerce/zalo'
import MomoConfig from '~/config/ecommerce/momo'

import Order from '~/models/ecommerce/order.model'
import Cart from '~/models/ecommerce/cart.model'
import Product from '~/models/ecommerce/product.model'
import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'

type OrderItem = {
  product: string
  title: string
  size: string
  amount: number
  image: string
  price: number
}

interface CreateOrderRequest extends Request {
  body: {
    paymentMethod: string
  }
}

const generateZaloOrder = (totalPrice: number, userId: string, cartId: string) => {
  const transID = Math.floor(Math.random() * 1000000)
  const zaloOrder = {
    app_id: ZaloConfig.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
    app_user: 'user123',
    app_time: Date.now(),
    item: JSON.stringify([{}]),
    embed_data: JSON.stringify({ redirecturl: 'http://localhost:5173/account/orders' }),
    amount: totalPrice,
    description: `Thanh toán đơn hàng #${transID}`,
    bank_code: '',
    callback_url: `https://recipe-alone-broadway-tn.trycloudflare.com/api/ecommerce/orders/zalo-callback?userId=${userId}&cartId=${cartId}`, // npx cloudflared tunnel --url http://localhost:8000
    mac: ''
  }

  const data = `${ZaloConfig.app_id}|${zaloOrder.app_trans_id}|${zaloOrder.app_user}|${zaloOrder.amount}|${zaloOrder.app_time}|${zaloOrder.embed_data}|${zaloOrder.item}`
  zaloOrder.mac = CryptoJS.HmacSHA256(data, ZaloConfig.key1).toString()

  return zaloOrder
}

const generateMomoOrder = (totalPrice: number, userId: string, cartId: string) => {
  //parameters
  const accessKey = MomoConfig.accessKey
  const secretKey = MomoConfig.secretKey
  const orderInfo = 'pay with MoMo'
  const partnerCode = MomoConfig.partnerCode
  const redirectUrl = 'http://localhost:5173/account/orders'
  const ipnUrl = `https://recipe-alone-broadway-tn.trycloudflare.com/api/ecommerce/orders/momo-callback?userId=${userId}&cartId=${cartId}` // npx cloudflared tunnel --url http://localhost:8000
  const requestType = 'payWithMethod'
  const amount = totalPrice
  const orderId = partnerCode + new Date().getTime()
  const requestId = orderId
  const extraData = ''
  const orderGroupId = ''
  const autoCapture = true
  const lang = 'vi'

  //before sign HMAC SHA256 with format
  const rawSignature =
    'accessKey=' +
    accessKey +
    '&amount=' +
    amount +
    '&extraData=' +
    extraData +
    '&ipnUrl=' +
    ipnUrl +
    '&orderId=' +
    orderId +
    '&orderInfo=' +
    orderInfo +
    '&partnerCode=' +
    partnerCode +
    '&redirectUrl=' +
    redirectUrl +
    '&requestId=' +
    requestId +
    '&requestType=' +
    requestType
  //signature
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')

  //json object send to MoMo endpoint
  const requestBody = JSON.stringify({
    partnerCode: partnerCode,
    partnerName: 'Test',
    storeId: 'MomoTestStore',
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    redirectUrl: redirectUrl,
    ipnUrl: ipnUrl,
    lang: lang,
    requestType: requestType,
    autoCapture: autoCapture,
    extraData: extraData,
    orderGroupId: orderGroupId,
    signature: signature
  })

  // options for axios
  const options = {
    method: 'POST',
    url: 'https://test-payment.momo.vn/v2/gateway/api/create',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    },
    data: requestBody
  }

  return options
}

export const createOrder = asyncHandler(async (req: CreateOrderRequest, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession() // Sử dụng transaction để đảm bảo tính nhất quán của dữ liệu
  session.startTransaction()

  try {
    const user = await User.findById(req.decoded?.userId).session(session)

    if (!user) {
      throw new ApiError(404, 'User not found')
    }

    const cart = await Cart.findOne({ user: req.decoded?.userId }).populate('cartItems.product').session(session)

    if (!cart || cart.cartItems.length === 0) {
      throw new ApiError(400, 'Cart is empty')
    }

    const { paymentMethod } = req.body
    const shippingAddress = {
      name: user.name,
      phone: user.phoneNumber,
      ...user.shippingAddress
    }
    const orderItems: OrderItem[] = cart.cartItems.map(
      ({
        product,
        quantity
      }: {
        product: {
          _id: string
          title: string
          size: string
          mainImage: string
          price: number
          priceDiscount: number
        }
        quantity: number
      }) => ({
        product: product._id.toString(),
        title: product.title,
        size: product.size,
        amount: quantity,
        image: product.mainImage,
        price: product.priceDiscount
          ? Math.round(product.price - (product.price * product.priceDiscount) / 100)
          : product.price
      })
    )
    const totalPrice = orderItems.reduce((acc, item) => acc + item.price * item.amount, 0)

    // Lấy danh sách sản phẩm và kiểm tra tồn kho
    const productMap = new Map(
      (await Product.find({ _id: { $in: orderItems.map((i) => i.product) } }).session(session)).map((p) => [
        p._id.toString(),
        p
      ])
    )

    // Kiểm tra số lượng tồn kho
    for (const item of orderItems) {
      const product = productMap.get(item.product)

      if (!product) {
        throw new ApiError(404, `Product (${item.title}) not found`)
      }

      if (item.amount > product.quantity || product.quantity < 1) {
        throw new ApiError(400, `Not enough (${product.title}) in stock`)
      }
    }

    if (paymentMethod === 'COD') {
      // Cập nhật số lượng sản phẩm trong kho
      const bulkOperations = orderItems.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { quantity: -item.amount } }
        }
      }))

      await Product.bulkWrite(bulkOperations, { session })

      // Tạo đơn hàng
      const order = new Order({
        user: req.decoded?.userId,
        orderItems,
        shippingAddress,
        paymentMethod,
        totalPrice
      })

      // Xóa giỏ hàng của người dùng
      cart.cartItems = []
      cart.totalQuantity = 0

      await order.save({ session })
      await cart.save({ session })

      // Commit transaction nếu mọi thứ thành công
      await session.commitTransaction()
      session.endSession()

      return res.status(201).json({
        message: 'Create cod order successfully',
        order
      })
    } else if (paymentMethod === 'ZALO') {
      const zaloOrder = generateZaloOrder(totalPrice, req.decoded?.userId as string, cart._id.toString())

      const response = await axios.post(ZaloConfig.endpoint, null, { params: zaloOrder })
      const responseData = response.data

      // Commit transaction nếu mọi thứ thành công
      await session.commitTransaction()

      res.status(responseData.return_code === 1 ? 201 : 400).json({
        message:
          responseData.return_code === 1
            ? 'Create zalo payment request successfully'
            : 'Create zalo payment request failed',
        detail: responseData
      })
    } else if (paymentMethod === 'MOMO') {
      const options = generateMomoOrder(totalPrice, req.decoded?.userId as string, cart._id.toString())

      const response = await axios(options)
      const responseData = response.data

      // Commit transaction nếu mọi thứ thành công
      await session.commitTransaction()

      res.status(201).json({
        message: 'Create momo payment request successfully',
        detail: responseData
      })
    } else if (paymentMethod === 'SEPAY') {
    }
  } catch (error) {
    await session.abortTransaction()
    next(error)
  } finally {
    session.endSession()
  }
})

export const zaloCallback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let result = { return_code: 1, return_message: 'success' }

  try {
    let dataStr = req.body.data
    let reqMac = req.body.mac
    const { userId, cartId } = req.query

    let mac = CryptoJS.HmacSHA256(dataStr, ZaloConfig.key2).toString()
    console.log('mac =', mac)

    // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    if (reqMac !== mac) {
      result = { return_code: -1, return_message: 'mac not equal' }
    } else {
      // cập nhật trạng thái đơn hàng
      const session = await mongoose.startSession()
      session.startTransaction()

      try {
        const user = await User.findById(userId).session(session)

        if (!user) {
          throw new ApiError(404, 'User not found')
        }

        const cart = await Cart.findById(cartId).populate('cartItems.product').session(session)

        if (!cart || cart.cartItems.length === 0) {
          throw new ApiError(404, 'Cart not found')
        }

        // Cập nhật số lượng sản phẩm trong kho
        const orderItems: OrderItem[] = cart.cartItems.map(
          ({
            product,
            quantity
          }: {
            product: {
              _id: string
              title: string
              size: string
              mainImage: string
              price: number
              priceDiscount: number
            }
            quantity: number
          }) => ({
            product: product._id.toString(),
            title: product.title,
            size: product.size,
            amount: quantity,
            image: product.mainImage,
            price: product.priceDiscount
              ? Math.round(product.price - (product.price * product.priceDiscount) / 100)
              : product.price
          })
        )

        const bulkOperations = orderItems.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { quantity: -item.amount } }
          }
        }))

        await Product.bulkWrite(bulkOperations, { session })

        // Tạo đơn hàng
        const order = new Order({
          user: userId,
          orderItems,
          shippingAddress: {
            name: user.name,
            phone: user.phoneNumber,
            ...user.shippingAddress
          },
          isPaid: true,
          paidAt: new Date(),
          paymentMethod: 'ZALO',
          totalPrice: orderItems.reduce((acc, item) => acc + item.price * item.amount, 0)
        })

        await order.save({ session })

        // Xóa giỏ hàng của người dùng
        cart.cartItems = []
        cart.totalQuantity = 0

        await cart.save({ session })

        await session.commitTransaction()
      } catch (error) {
        console.log(error)

        await session.abortTransaction()
      } finally {
        session.endSession()
      }
    }
  } catch (ex: any) {
    result = { return_code: 0, return_message: ex.message }
  }

  res.json(result)
})

export const momoCallback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { userId, cartId } = req.query

  // cập nhật trạng thái đơn hàng
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const user = await User.findById(userId).session(session)

    if (!user) {
      throw new ApiError(404, 'User not found')
    }

    const cart = await Cart.findById(cartId).populate('cartItems.product').session(session)

    if (!cart || cart.cartItems.length === 0) {
      throw new ApiError(404, 'Cart not found')
    }

    // Cập nhật số lượng sản phẩm trong kho
    const orderItems: OrderItem[] = cart.cartItems.map(
      ({
        product,
        quantity
      }: {
        product: {
          _id: string
          title: string
          size: string
          mainImage: string
          price: number
          priceDiscount: number
        }
        quantity: number
      }) => ({
        product: product._id.toString(),
        title: product.title,
        size: product.size,
        amount: quantity,
        image: product.mainImage,
        price: product.priceDiscount
          ? Math.round(product.price - (product.price * product.priceDiscount) / 100)
          : product.price
      })
    )

    const bulkOperations = orderItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.amount } }
      }
    }))

    await Product.bulkWrite(bulkOperations, { session })

    // Tạo đơn hàng
    const order = new Order({
      user: userId,
      orderItems,
      shippingAddress: {
        name: user.name,
        phone: user.phoneNumber,
        ...user.shippingAddress
      },
      isPaid: true,
      paidAt: new Date(),
      paymentMethod: 'MOMO',
      totalPrice: orderItems.reduce((acc, item) => acc + item.price * item.amount, 0)
    })

    await order.save({ session })

    // Xóa giỏ hàng của người dùng
    cart.cartItems = []
    cart.totalQuantity = 0

    await cart.save({ session })

    await session.commitTransaction()
  } catch (error) {
    console.log(error)

    await session.abortTransaction()
  } finally {
    session.endSession()
  }

  res.status(200).json(req.body)
})

export const sepayCallback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {})

export const cancelOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.decoded?.userId)

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  const order = await Order.findById(req.params.orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  if (order.user.toString() !== req.decoded?.userId) {
    throw new ApiError(403, 'You are not allowed to cancel this order')
  }

  if (order.isPaid) {
    throw new ApiError(400, 'Order is already paid')
  }

  order.status = 'Cancelled'
  await order.save()

  res.status(200).json({
    message: 'Cancel order successfully',
    order
  })
})

// CRUD
interface GetOrdersRequest extends Request {
  query: {
    page: string
    limit: string
  }
}

export const getMyOrders = asyncHandler(async (req: GetOrdersRequest, res: Response, next: NextFunction) => {
  const { page = '1', limit = '5' } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [totalOrders, orders] = await Promise.all([
    Order.countDocuments({ user: req.decoded?.userId }),
    Order.find({ user: req.decoded?.userId }).skip(skip).limit(parseInt(limit)).sort('-createdAt').lean()
  ])

  const totalPages = Math.ceil(totalOrders / parseInt(limit)) || 1

  res.status(200).json({
    message: 'Get user orders successfully',
    orders,
    pagination: {
      totalOrders,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit)
    }
  })
})

export const getAdminOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const orders = await Order.find().lean()

  res.status(200).json({
    message: 'Get admin orders successfully',
    orders
  })
})

export const getOrderById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const order = await Order.findById(req.params.orderId).lean()

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  res.status(200).json({
    message: 'Get order successfully',
    order
  })
})
