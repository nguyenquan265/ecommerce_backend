import { NextFunction, Request, Response } from 'express'

import Category from '~/models/ecommerce/category.model'
import Product from '~/models/ecommerce/product.model'
import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'
import slugify from '~/utils/slugify'

interface GetProductsRequest extends Request {
  query: {
    page?: string
    limit?: string
    searchString?: string
    sortBy?: 'asc' | 'desc' | 'a-z' | 'z-a' | 'price-asc' | 'price-desc'
    categorySlug?: string
  }
}

export const getAllProducts = asyncHandler(async (req: GetProductsRequest, res: Response, next: NextFunction) => {
  const { page = '1', limit = '10', searchString = '', sortBy = 'desc', categorySlug } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const currentUser = await User.findById(req.decoded?.userId)

  let filter: any = currentUser?.isAdmin ? {} : { isDeleted: false }
  let sort: any = { createdAt: -1 }

  if (searchString) {
    const searchRegex = new RegExp(searchString, 'i')

    filter = {
      ...filter,
      $or: [{ title: searchRegex }, { slug: searchRegex }]
    }
  }

  if (categorySlug !== 'all') {
    const category = await Category.findOne({ slug: categorySlug })

    if (category) {
      filter = {
        ...filter,
        category: category._id
      }
    }
  }

  if (sortBy === 'asc') {
    sort = { createdAt: 1 }
  } else if (sortBy === 'a-z') {
    sort = { title: 1 }
  } else if (sortBy === 'z-a') {
    sort = { title: -1 }
  } else if (sortBy === 'price-asc') {
    sort = { price: 1 }
  } else if (sortBy === 'price-desc') {
    sort = { price: -1 }
  } else {
    sort = { createdAt: -1 }
  }

  const [totalProducts, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).populate('category').skip(skip).limit(parseInt(limit)).sort(sort).lean()
  ])

  const totalPages = Math.ceil(totalProducts / parseInt(limit)) || 1

  res.status(200).json({
    message: 'Get all products successfully',
    products,
    pagination: {
      totalProducts,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit)
    }
  })
})

export const getProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  const filter = currentUser?.isAdmin ? { _id: req.params.productId } : { _id: req.params.productId, isDeleted: false }

  const product = await Product.findOne(filter).populate('category').lean()

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  res.status(200).json({ message: 'Get product successfully', product })
})

// admin only
export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description, categoryId, size, price, priceDiscount, quantity, mainImage, subImages } = req.body
  const slug = slugify(title)

  const product = await Product.create({
    title,
    slug,
    description,
    category: categoryId,
    size,
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
  const { title, description, categoryId, size, price, priceDiscount, quantity, mainImage, subImages } = req.body

  const product = await Product.findByIdAndUpdate(
    req.params.productId,
    {
      title,
      slug: slugify(title),
      description,
      category: categoryId,
      size,
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
  const product = await Product.findByIdAndUpdate(req.params.productId, { isDeleted: true }).lean()

  if (!product) {
    throw new ApiError(404, 'Product not found')
  }

  res.status(200).json({ message: 'Delete product successfully' })
})
