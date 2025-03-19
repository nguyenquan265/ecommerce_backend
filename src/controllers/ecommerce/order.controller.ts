import { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import moment from 'moment'

import ZaloConfig from '../../config/ecommerce/zalo'

import Order from '../../models/ecommerce/order.model'
import Cart from '../../models/ecommerce/cart.model'
import Product from '../../models/ecommerce/product.model'
import User from '../../models/ecommerce/user.model'
import Category from '../../models/ecommerce/category.model'

import ApiError from '../../utils/ApiError'
import asyncHandler from '../../utils/asyncHandler'
import calculatePrice from '../../utils/calculatePrice'
import { generateMomoOrder, generateZaloOrder } from '../../utils/generateOrder'

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
        price: product.priceDiscount ? calculatePrice(product.price, product.priceDiscount) : product.price
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
          update: {
            $inc: {
              quantity: -item.amount,
              sold: item.amount
            }
          }
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
            price: product.priceDiscount ? calculatePrice(product.price, product.priceDiscount) : product.price
          })
        )

        const bulkOperations = orderItems.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: {
              $inc: {
                quantity: -item.amount,
                sold: item.amount
              }
            }
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
        price: product.priceDiscount ? calculatePrice(product.price, product.priceDiscount) : product.price
      })
    )

    const bulkOperations = orderItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.amount, sold: item.amount } }
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
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const user = await User.findById(req.decoded?.userId).lean().session(session)

    if (!user) {
      throw new ApiError(404, 'User not found')
    }

    const order = await Order.findById(req.params.orderId).session(session)
    if (!order) {
      throw new ApiError(404, 'Order not found')
    }

    if (order.user.toString() !== req.decoded?.userId) {
      throw new ApiError(403, 'You are not allowed to cancel this order')
    }

    if (order.isPaid) {
      throw new ApiError(400, 'Order is already paid')
    }

    // Cập nhật trạng thái đơn hàng
    order.status = 'Cancelled'
    await order.save({ session })

    // Cập nhật lại số lượng sản phẩm
    const bulkOperations = order.orderItems.map((item: any) => ({
      updateOne: {
        filter: { _id: item.product },
        update: {
          $inc: {
            quantity: item.amount, // Trả lại số lượng
            sold: -item.amount // Giảm số lượng đã bán
          }
        }
      }
    }))

    await Product.bulkWrite(bulkOperations, { session })

    await session.commitTransaction()

    res.status(200).json({
      message: 'Cancel order successfully',
      order
    })
  } catch (error) {
    console.error(error)
    await session.abortTransaction()
    next(error)
  } finally {
    session.endSession()
  }
})

export const confirmOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.decoded?.userId).lean()

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
const fetchOrders = async (filter: any, sort: any, page: number, limit: number) => {
  const skip = (page - 1) * limit

  return Promise.all([Order.countDocuments(filter), Order.find(filter).skip(skip).limit(limit).sort(sort).lean()])
}

interface GetMyOrdersRequest extends Request {
  query: {
    page: string
    limit: string
  }
}

export const getMyOrders = asyncHandler(async (req: GetMyOrdersRequest, res: Response, next: NextFunction) => {
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.max(Number(req.query.limit) || 5, 1)
  const filter = { user: req.decoded?.userId }
  const sort = { createdAt: -1 }

  const [totalOrders, orders] = await fetchOrders(filter, sort, page, limit)

  res.status(200).json({
    message: 'Get user orders successfully',
    orders,
    pagination: {
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit) || 1,
      currentPage: page,
      limit
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
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.max(Number(req.query.limit) || 10, 1)

  let filter: any = {}
  let sort: any = { createdAt: -1 }

  if (req.query.searchString) {
    const searchRegex = new RegExp(req.query.searchString, 'i')

    filter = {
      ...filter,
      $or: [{ 'shippingAddress.name': searchRegex }, { 'shippingAddress.phone': searchRegex }]
    }
  }

  if (req.query.paymentMethod && req.query.paymentMethod !== 'all') {
    filter = {
      ...filter,
      paymentMethod: req.query.paymentMethod
    }
  }

  switch (req.query.sortBy) {
    case 'asc':
      sort = { createdAt: 1 }
      break
    case 'a-z':
      sort = { 'shippingAddress.name': 1 }
      break
    case 'z-a':
      sort = { 'shippingAddress.name': -1 }
      break
  }

  const [totalOrders, orders] = await fetchOrders(filter, sort, page, limit)

  res.status(200).json({
    message: 'Get admin orders successfully',
    orders,
    pagination: {
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit) || 1,
      currentPage: page,
      limit
    }
  })
})

interface GetOrderOverviewRequest extends Request {
  query: {
    orderTimeOption: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear'
  }
}

export const getOrderOverview = asyncHandler(async (req: GetOrderOverviewRequest, res: Response) => {
  const { orderTimeOption } = req.query

  const timeRange = {
    today: [moment().startOf('day'), moment().endOf('day')],
    yesterday: [moment().subtract(1, 'day').startOf('day'), moment().subtract(1, 'day').endOf('day')],
    thisWeek: [moment().startOf('week'), moment().endOf('week')],
    thisMonth: [moment().startOf('month'), moment().endOf('month')],
    thisYear: [moment().startOf('year'), moment().endOf('year')]
  }

  const [startDate, endDate] = timeRange[orderTimeOption] || [moment().startOf('day'), moment().endOf('day')]

  // Truy vấn đơn hàng theo khoảng thời gian
  const orders = await Order.find({
    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
  })

  // Tính toán tổng hợp chỉ duyệt 1 lần
  const overview = orders.reduce(
    (acc, order) => {
      acc.totalRevenue += order.isPaid ? order.totalPrice : 0
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    },
    { totalRevenue: 0, Pending: 0, Processing: 0, Delivering: 0, Delivered: 0, Cancelled: 0 }
  )

  res.status(200).json({
    message: 'Get order overview successfully',
    data: {
      totalRevenue: overview.totalRevenue,
      pendingOrders: overview.Pending,
      processingOrders: overview.Processing,
      onTheWayOrders: overview.Delivering,
      deliveredOrders: overview.Delivered,
      cancelledOrders: overview.Cancelled
    }
  })
})

export const getOrderShopOverview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const [products, orders, users, totalCategories, orderChartData] = await Promise.all([
    Product.find(),
    Order.find(),
    User.find(),
    Category.countDocuments(),
    getRevenueByMonth()
  ])

  const totalUsers = users.length
  const totalEmailUsers = users.filter((user) => user.isGoogleAccount === false).length
  const totalGoogleUsers = users.filter((user) => user.isGoogleAccount === true).length

  const totalProducts = products.length
  const totalProductInStock = products.reduce((acc, product) => acc + product.quantity, 0)
  const totalDeletedProducts = products.filter((product) => product.isDeleted).length
  const lowStockProducts = products.filter((product) => product.quantity <= 10)

  const orderStats = orders.reduce(
    (acc, order) => {
      acc.totalRevenue += order.isPaid ? order.totalPrice : 0
      acc.totalOrders++
      acc.isPaidOrders += order.isPaid ? 1 : 0
      acc[order.status] = (acc[order.status] || 0) + 1
      acc.paymentMethod[order.paymentMethod] = (acc.paymentMethod[order.paymentMethod] || 0) + 1
      return acc
    },
    {
      totalOrders: 0,
      isPaidOrders: 0,
      Delivered: 0,
      Cancelled: 0,
      totalRevenue: 0,
      paymentMethod: { COD: 0, ZALO: 0, MOMO: 0, SEPAY: 0 }
    }
  )

  // Chuyển đổi object thành array cho JSON response
  const paymentMethodArr = Object.entries(orderStats.paymentMethod).map(([method, count]) => ({
    method,
    count
  }))

  res.status(200).json({
    message: 'Get shop overview successfully',
    data: {
      totalProducts,
      totalUsers,
      totalOrders: orderStats.totalOrders,
      deliveredOrders: orderStats.Delivered,
      cancelledOrders: orderStats.Cancelled,
      totalRevenue: orderStats.totalRevenue,
      totalProductInStock,
      totalCategories,
      isPaidOrders: orderStats.isPaidOrders,
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
