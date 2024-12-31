import { NextFunction, Request, RequestHandler, Response } from 'express'

import asyncHandler from '~/utils/asyncHandler'
import ApiError from '~/utils/ApiError'
import { verifyAccessToken } from '~/utils/token'

export const authenticate: RequestHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const headers = req.headers.authorization
  const accesstoken = headers ? headers.split(' ')[1] : ''

  if (!accesstoken) {
    throw new ApiError(401, 'Unauthorized - No access token')
  }

  const decoded = verifyAccessToken(accesstoken)

  if (!decoded) {
    throw new ApiError(401, 'Unauthorized - Invalid token')
  }

  req.userId = decoded.userId
  next()
})
