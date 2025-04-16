import { NextFunction, Request, Response } from 'express'

import Category from '../../models/ecommerce/category.model'
import Product from '../../models/ecommerce/product.model'

import asyncHandler from '../../utils/asyncHandler'

export const getChatInformation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const products = await Product.find({ isDeleted: false }).populate('category').lean()
  const countProducts = products.length
  const mostSoldProducts = products.sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5)

  const categories = await Category.find().lean()
  const countCategories = categories.length

  res.status(200).json({
    products,
    countProducts,
    mostSoldProducts,
    categories,
    countCategories
  })
})
