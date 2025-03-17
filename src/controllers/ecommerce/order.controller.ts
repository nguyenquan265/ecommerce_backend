import { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import moment from 'moment'
import crypto from 'crypto'

import ZaloConfig from '../../config/ecommerce/zalo'
import MomoConfig from '../../config/ecommerce/momo'

import Order from '../../models/ecommerce/order.model'
import Cart from '../../models/ecommerce/cart.model'
import Product from '../../models/ecommerce/product.model'
import User from '../../models/ecommerce/user.model'

import ApiError from '../../utils/ApiError'
import asyncHandler from '../../utils/asyncHandler'
import Category from '../../models/ecommerce/category.model'

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
    callback_url: `ecommercetrello-production.up.railway.app/api/ecommerce/orders/zalo-callback?userId=${userId}&cartId=${cartId}`, // npx cloudflared tunnel --url http://localhost:8000
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
  const ipnUrl = `ecommercetrello-production.up.railway.app/api/ecommerce/orders/momo-callback?userId=${userId}&cartId=${cartId}` // npx cloudflared tunnel --url http://localhost:8000
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

const getRevenueByMonth = async () => {
  const revenue = await Order.aggregate([
    {
      $match: { isPaid: true } // Chỉ tính các đơn đã thanh toán
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        totalRevenue: { $sum: '$totalPrice' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ])

  return revenue.map((item) => ({
    month: `${item._id.year}-${item._id.month}`,
    totalRevenue: item.totalRevenue
  }))
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
      email: user.email,
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
            email: user.email,
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
        email: user.email,
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

export const confirmOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.decoded?.userId)

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  const order = await Order.findById(req.params.orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  if (order.user.toString() !== req.decoded?.userId) {
    throw new ApiError(403, 'You are not allowed to confirm this order')
  }

  order.status = 'Delivered'
  await order.save()

  res.status(200).json({
    message: 'Confirm order successfully',
    order
  })
})

// CRUD
interface GetMyOrdersRequest extends Request {
  query: {
    page: string
    limit: string
  }
}

export const getMyOrders = asyncHandler(async (req: GetMyOrdersRequest, res: Response, next: NextFunction) => {
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

interface GetOrdersRequest extends Request {
  query: {
    page?: string
    limit?: string
    searchString?: string
    paymentMethod?: string
    sortBy?: 'asc' | 'desc' | 'a-z' | 'z-a'
  }
}

export const getAdminOrders = asyncHandler(async (req: GetOrdersRequest, res: Response, next: NextFunction) => {
  const { page = '1', limit = '10', searchString = '', sortBy = 'desc', paymentMethod } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  let filter: any = {}
  let sort: any = { createdAt: -1 }

  if (searchString) {
    const searchRegex = new RegExp(searchString, 'i')

    filter = {
      ...filter,
      $or: [{ 'shippingAddress.name': searchRegex }, { 'shippingAddress.phone': searchRegex }]
    }
  }

  if (paymentMethod && paymentMethod !== 'all') {
    filter = {
      ...filter,
      paymentMethod
    }
  }

  if (sortBy === 'asc') {
    sort = { createdAt: 1 }
  } else if (sortBy === 'a-z') {
    sort = { 'shippingAddress.name': 1 }
  } else if (sortBy === 'z-a') {
    sort = { 'shippingAddress.name': -1 }
  } else {
    sort = { createdAt: -1 }
  }

  const [totalOrders, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).skip(skip).limit(parseInt(limit)).sort(sort).lean()
  ])

  const totalPages = Math.ceil(totalOrders / parseInt(limit)) || 1

  res.status(200).json({
    message: 'Get admin orders successfully',
    orders,
    pagination: {
      totalOrders,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit)
    }
  })
})

interface GetOrderOverviewRequest extends Request {
  query: {
    orderTimeOption: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear'
  }
}

export const getOrderOverview = asyncHandler(
  async (req: GetOrderOverviewRequest, res: Response, next: NextFunction) => {
    const { orderTimeOption } = req.query

    let startDate = new Date()
    let endDate = new Date()

    if (orderTimeOption === 'today') {
      startDate = moment().startOf('day').toDate()
      endDate = moment().endOf('day').toDate()
    } else if (orderTimeOption === 'yesterday') {
      startDate = moment().subtract(1, 'day').startOf('day').toDate()
      endDate = moment().subtract(1, 'day').endOf('day').toDate()
    } else if (orderTimeOption === 'thisWeek') {
      startDate = moment().startOf('week').toDate()
      endDate = moment().endOf('week').toDate()
    } else if (orderTimeOption === 'thisMonth') {
      startDate = moment().startOf('month').toDate()
      endDate = moment().endOf('month').toDate()
    } else if (orderTimeOption === 'thisYear') {
      startDate = moment().startOf('year').toDate()
      endDate = moment().endOf('year').toDate()
    }

    const orders = await Order.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })

    const totalRevenue = orders.reduce((acc, order) => (order.isPaid ? acc + order.totalPrice : acc), 0)
    const pendingOrders = orders.filter((order) => order.status === 'Pending').length
    const processingOrders = orders.filter((order) => order.status === 'Processing').length
    const onTheWayOrders = orders.filter((order) => order.status === 'Delivering').length
    const deliveredOrders = orders.filter((order) => order.status === 'Delivered').length
    const cancelledOrders = orders.filter((order) => order.status === 'Cancelled').length

    res.status(200).json({
      message: 'Get order overview successfully',
      data: {
        totalRevenue,
        cancelledOrders,
        onTheWayOrders,
        processingOrders,
        deliveredOrders,
        pendingOrders
      }
    })
  }
)

export const getOrderShopOverview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const products = await Product.find()
  const orders = await Order.find()
  const users = await User.find()
  const totalCategories = await Category.countDocuments()
  const orderChartData = await getRevenueByMonth()

  const totalUsers = users.length
  const totalEmailUsers = users.filter((user) => user.isGoogleAccount === false).length
  const totalGoogleUsers = users.filter((user) => user.isGoogleAccount === true).length

  const totalProducts = products.length
  const totalProductInStock = products.reduce((acc, product) => acc + product.quantity, 0)
  const totalDeletedProducts = products.filter((product) => product.isDeleted).length
  const lowStockProducts = products.filter((product) => product.quantity <= 10)

  const totalOrders = orders.length
  const isPaidOrders = orders.filter((order) => order.isPaid).length
  const deliveredOrders = orders.filter((order) => order.status === 'Delivered').length
  const cancelledOrders = orders.filter((order) => order.status === 'Cancelled').length
  const totalRevenue = orders.reduce((acc, order) => (order.isPaid ? acc + order.totalPrice : acc), 0)
  const paymentMethodArr = [
    { method: 'COD', count: 0 },
    { method: 'ZALO', count: 0 },
    { method: 'MOMO', count: 0 },
    { method: 'SEPAY', count: 0 }
  ]
  orders.map((order) => {
    paymentMethodArr.map((method) => {
      if (order.paymentMethod === method.method) {
        method.count++
      }
    })
  })

  res.status(200).json({
    message: 'Get shop overview successfully',
    data: {
      totalProducts,
      totalUsers,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      totalProductInStock,
      totalCategories,
      isPaidOrders,
      lowStockProducts,
      paymentMethodArr,
      totalEmailUsers,
      totalGoogleUsers,
      totalDeletedProducts,
      orderChartData
    }
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

export const updateOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    name,
    phone,
    province,
    provinceName,
    district,
    districtName,
    ward,
    wardName,
    address,
    paymentMethod,
    isPaid,
    isDelivered,
    status
  } = req.body

  const order = await Order.findById(req.params.orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  order.shippingAddress = {
    name,
    phone,
    province,
    provinceName,
    district,
    districtName,
    ward,
    wardName,
    address
  }

  order.paymentMethod = paymentMethod
  order.isPaid = isPaid
  order.isDelivered = isDelivered
  order.status = status

  await order.save()

  res.status(200).json({
    message: 'Update order successfully',
    order
  })
})

export const deleteOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const order = await Order.findByIdAndDelete(req.params.orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  res.status(200).json({
    message: 'Delete order successfully',
    order
  })
})
