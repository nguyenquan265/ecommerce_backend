import { NextFunction, Request, RequestHandler, Response } from 'express'

import { verifyAccessToken } from '~/utils/token'

export const authenticate: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const headers = req.headers.authorization
  const accessToken = headers ? headers.split(' ')[1] : ''

  try {
    if (!accessToken) {
      return res.status(401).json({ message: 'Unauthorized! (token not found)' })
    }

    const decoded = verifyAccessToken(accessToken)

    req.decoded = decoded

    next()
  } catch (error: any) {
    if (error.message?.includes('jwt expired')) {
      return res.status(401).json({
        message: 'Unauthorized! (token expired)'
      })
    }

    return res.status(401).json({
      message: 'Unauthorized! (token invalid)'
    })
  }
}
