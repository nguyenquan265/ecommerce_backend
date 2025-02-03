import { NextFunction, Request, Response } from 'express'
import { Error as MongoError } from 'mongoose'

import ApiError from '../utils/ApiError'

const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  let errorCode = 500
  let errorMsg = 'Something went wrong.'

  console.log('****************')
  console.log('****************')
  console.log(error)
  console.log('****************')
  console.log('****************')

  if (error instanceof ApiError) {
    errorCode = error.statusCode
    errorMsg = error.message
  }

  if (error instanceof MongoError) {
    errorCode = 400
    errorMsg = error.message

    if (error instanceof MongoError.CastError) {
      errorMsg = `Invalid ${error.path}: ${error.value}.`
    }

    if (error instanceof MongoError.ValidationError) {
      const errors = Object.values(error.errors).map((err) => err.message)
      errorMsg = `Invalid input. ${errors.join(' ')}`
    }
  }

  if (error.code === 11000) {
    const value = error.errmsg.match(/(["'])(\\?.)*?\1/)[0]
    errorCode = 400
    errorMsg = `Duplicate field value: ${value}.`
  }

  // JWT error handling for refresh token of ecommerce
  if (error.message?.includes('jwt expired')) {
    errorCode = 401
    errorMsg = 'Unauthorized! (Refresh token expired)'
  }

  if (error) res.status(errorCode).json({ message: errorMsg })
}

export default errorHandler
