import { NextFunction, Request, Response } from 'express'

import Product from '~/models/ecommerce/product.model'
import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'
import slugify from '~/utils/slugify'

export const getAllProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  const filter = currentUser?.isAdmin ? {} : { isDeleted: { $ne: true } }

  const products = await Product.find(filter).populate('category').lean()

  res.status(200).json({ message: 'Get all products successfully', products })
})

export const getProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  const filter = currentUser?.isAdmin ? {} : { isDeleted: { $ne: true } }

  const product = await Product.findById(req.params.productId, filter).populate('category').lean()

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  res.status(200).json({ message: 'Get product successfully', product })
})

// admin only
export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const { title, description, categoryId, price, priceDiscount, quantity, mainImage, subImages } = req.body
  const slug = slugify(title)

  const product = await Product.create({
    title,
    slug,
    description,
    category: categoryId,
    price,
    priceDiscount,
    quantity,
    mainImage,
    subImages
  })

  res.status(201).json({ message: 'Create product successfully', product })
})

// admin only
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const { title, description, categoryId, price, priceDiscount, quantity, mainImage, subImages } = req.body

  const product = await Product.findByIdAndUpdate(
    req.params.productId,
    {
      title,
      slug: slugify(title),
      description,
      category: categoryId,
      price,
      priceDiscount,
      quantity,
      mainImage,
      subImages
    },
    { new: true }
  ).lean()

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  res.status(200).json({ message: 'Update product successfully', product })
})

// admin only
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const product = await Product.findByIdAndUpdate(req.params.productId, { isDeleted: true }).lean()

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  res.status(200).json({ message: 'Delete product successfully' })
})
