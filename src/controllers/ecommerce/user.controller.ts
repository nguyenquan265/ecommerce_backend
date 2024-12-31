import { compare, genSalt, hash } from 'bcryptjs'
import { NextFunction, Request, Response } from 'express'

import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '~/utils/token'

export const signUp = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    throw new ApiError(400, 'Please provide name, email and password')
  }

  const user = await User.findOne({ email })

  if (user) {
    throw new ApiError(400, 'User already exists')
  }

  const salt = await genSalt(10)
  const hashedPassword = await hash(password, salt)

  const newUser = new User({ name, email, password: hashedPassword })
  await newUser.save()
  delete newUser._doc.password

  const accessToken = generateAccessToken(newUser._id)
  const refreshToken = generateRefreshToken(newUser._id)

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  })

  res.status(201).json({
    message: 'Sign up successful',
    user: newUser.toObject(),
    accessToken
  })
})

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new ApiError(400, 'Please provide email and password')
  }

  const user = await User.findOne({ email }).select('+password')

  if (!user) {
    throw new ApiError(401, 'Invalid credentials')
  }

  if (user.isGoogleAccount) {
    throw new ApiError(401, 'Please login with Google')
  }

  if (!(await compare(password, user.password))) {
    throw new ApiError(401, 'Invalid credentials')
  }

  delete user._doc.password

  const accessToken = generateAccessToken(user._id)
  const refreshToken = generateRefreshToken(user._id)

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  })

  res.status(200).json({
    message: 'Login successful',
    user: user.toObject(),
    accessToken
  })
})

export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  res.clearCookie('refreshToken')

  res.status(200).json({
    message: 'Logout successful'
  })
})

export const loginWithGoogle = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, photoUrl } = req.body

  if (!name || !email) {
    throw new ApiError(400, 'Please provide name and email')
  }

  const user = await User.findOne({ email })

  if (!user) {
    const newUser = new User({ name, email, photoUrl, isGoogleAccount: true })
    await newUser.save()
    delete newUser._doc.password

    const accessToken = generateAccessToken(newUser._id)
    const refreshToken = generateRefreshToken(newUser._id)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(201).json({
      message: 'Login with Google successful',
      user: newUser.toObject(),
      accessToken
    })
  } else {
    if (!user.isGoogleAccount) {
      throw new ApiError(400, 'Please login with email and password')
    }

    delete user._doc.password

    const accessToken = generateAccessToken(user._id)
    const refreshToken = generateRefreshToken(user._id)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(200).json({
      message: 'Login with Google successful',
      user: user.toObject(),
      accessToken
    })
  }
})

export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const refreshToken = req.cookies.refreshToken

  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token')
  }

  const decoded = verifyRefreshToken(refreshToken)

  if (!decoded) {
    throw new ApiError(401, 'Invalid refresh token')
  }

  const accessToken = generateAccessToken(decoded.userId)
  const newRefreshToken = generateRefreshToken(decoded.userId)

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
  })

  res.status(200).json({
    message: 'Refresh token generated',
    accessToken
  })
})

export const checkAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.userId).lean()

  res.status(200).json({
    message: 'Authenticated',
    user: currentUser
  })
})

export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {})
