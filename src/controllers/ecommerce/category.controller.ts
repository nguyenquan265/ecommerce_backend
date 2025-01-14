import { NextFunction, Request, Response } from 'express'

import Category from '~/models/ecommerce/category.model'
import Product from '~/models/ecommerce/product.model'
import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'
import slugify from '~/utils/slugify'

export const getAllCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const categories = await Category.find().lean()

  res.status(200).json({
    message: 'Get all categories successfully',
    categories
  })
})

// admin only
export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const { name } = req.body

  if (!name) {
    throw new ApiError(400, 'Name is required')
  }

  const slug = slugify(name)
  const category = await Category.create({ name, slug })

  res.status(201).json({
    message: 'Create category successfully',
    category: category.toObject()
  })
})

export const getCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { categoryId } = req.params

  if (!categoryId) {
    throw new ApiError(400, 'Category ID is required')
  }

  const category = await Category.findById(categoryId).lean()

  if (!category) {
    throw new ApiError(404, 'Category not found')
  }

  res.status(200).json({
    message: 'Get category successfully',
    category
  })
})

// admin only
export const updateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const { categoryId } = req.params
  const { name, slug } = req.body

  if (!categoryId) {
    throw new ApiError(400, 'Category ID is required')
  }

  const category = await Category.findByIdAndUpdate(categoryId, { name, slug }).lean()

  if (!category) {
    throw new ApiError(404, 'Category not found')
  }

  res.status(200).json({
    message: 'Update category successfully',
    category
  })
})

// admin only
export const deleteCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const { categoryId } = req.params

  if (!categoryId) {
    throw new ApiError(400, 'Category ID is required')
  }

  const existedProducts = await Product.find({ category: categoryId }).lean()

  if (existedProducts.length) {
    throw new ApiError(400, 'Category has products, cannot delete')
  }

  const category = await Category.findByIdAndDelete(categoryId)

  if (!category) {
    throw new ApiError(404, 'Category not found')
  }

  res.status(200).json({
    message: 'Delete category successfully'
  })
})
