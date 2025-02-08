import { NextFunction, Request, Response } from 'express'
import { Types } from 'mongoose'

import Cart from '~/models/ecommerce/cart.model'
import Product from '~/models/ecommerce/product.model'
import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'

export const getCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const cart = await Cart.findOne({ user: req.decoded?.userId }).populate('cartItems.product').lean()

  res.status(200).json({
    message: 'Get cart successfully',
    cart
  })
})

interface AddToCartRequest extends Request {
  body: {
    productId: string
    quantity: number
  }
}

export const addToCart = asyncHandler(async (req: AddToCartRequest, res: Response, next: NextFunction) => {
  const { productId, quantity } = req.body

  const product = await Product.findById(productId)

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  if (product.quantity < 1 || product.quantity < quantity) {
    throw new ApiError(400, 'Out of stock')
  }

  const user = await User.findById(req.decoded?.userId)

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  let cart = await Cart.findOne({ user: req.decoded?.userId })

  if (!cart) {
    cart = new Cart({
      user: req.decoded?.userId,
      cartItems: [
        {
          product: productId,
          quantity
        }
      ],
      totalPrice: product.price * quantity,
      totalQuantity: quantity
    })

    await cart.save()
  } else {
    const cartItemIndex = cart.cartItems.findIndex(
      (cartItem: { product: Types.ObjectId; quantity: number }) => cartItem.product.toString() === productId
    )

    if (cartItemIndex >= 0) {
      cart.cartItems[cartItemIndex].quantity += quantity
    } else {
      cart.cartItems.push({
        product: productId,
        quantity
      })
    }

    cart.totalPrice += product.price * quantity
    cart.totalQuantity += quantity

    await cart.save()
  }

  res.status(200).json({
    message: 'Add to cart successfully',
    cart
  })
})

export const removeFromCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { productId } = req.params

  const product = await Product.findById(productId)

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  const cart = await Cart.findOne({ user: req.decoded?.userId })

  if (!cart) {
    throw new ApiError(404, 'Cart not found')
  }

  const cartItemIndex = cart.cartItems.findIndex(
    (cartItem: { product: Types.ObjectId; quantity: number }) => cartItem.product.toString() === productId
  )

  if (cartItemIndex < 0) {
    throw new ApiError(404, 'Product not in cart')
  }

  const cartItem = cart.cartItems[cartItemIndex]
  cart.totalPrice -= product.price * cartItem.quantity
  cart.totalQuantity -= cartItem.quantity
  cart.cartItems.splice(cartItemIndex, 1)

  await cart.save()

  res.status(200).json({
    message: 'Remove from cart successfully',
    cart
  })
})
