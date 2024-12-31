import { NextFunction, Request, Response } from 'express'

import Product from '~/models/ecommerce/product.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'

export const getProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {})
