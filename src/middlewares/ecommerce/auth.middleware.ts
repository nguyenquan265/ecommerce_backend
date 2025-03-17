import { NextFunction, Request, RequestHandler, Response } from 'express'

import User from '../../models/ecommerce/user.model'

import { verifyAccessToken } from '../../utils/token'

export const authenticate: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const headers = req.headers.authorization
  const accessToken = headers ? headers.split(' ')[1] : ''

  try {
    if (!accessToken) {
      return res.status(401).json({ message: 'Unauthorized! (Access token not found)' })
    }

    const decoded = await verifyAccessToken(accessToken)

    req.decoded = decoded

    next()
  } catch (error: any) {
    if (error.message?.includes('jwt expired')) {
      return res.status(401).json({
        message: 'Unauthorized! (Access token expired)'
      })
    }

    return res.status(401).json({
      message: 'Unauthorized! (Access token invalid)'
    })
  }
}

export const isAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to perform this action' })
  }

  next()
}
