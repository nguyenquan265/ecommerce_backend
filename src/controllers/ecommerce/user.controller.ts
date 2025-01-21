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
  delete newUser._doc.isActive
  delete newUser._doc.isAdmin

  const accessToken = await generateAccessToken({ userId: newUser._id, email: newUser.email })
  const refreshToken = await generateRefreshToken({ userId: newUser._id, email: newUser.email })

  res.status(201).json({
    message: 'Sign up successful',
    user: newUser.toObject(),
    accessToken,
    refreshToken
  })
})

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new ApiError(400, 'Please provide email and password')
  }

  const user = await User.findOne({ email }).select('+password')

  if (!user) {
    throw new ApiError(400, 'Invalid credentials')
  }

  if (user.isGoogleAccount) {
    throw new ApiError(400, 'Please login with Google')
  }

  if (!(await compare(password, user.password))) {
    throw new ApiError(400, 'Invalid credentials')
  }

  if (!user.isActive) {
    throw new ApiError(403, 'User is not active')
  }

  delete user._doc.password
  delete user._doc.isActive
  delete user._doc.isAdmin

  const accessToken = await generateAccessToken({ userId: user._id, email: user.email })
  const refreshToken = await generateRefreshToken({ userId: user._id, email: user.email })

  res.status(200).json({
    message: 'Login successful',
    user: user.toObject(),
    accessToken,
    refreshToken
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
    delete newUser._doc.isActive
    delete newUser._doc.isAdmin

    const accessToken = await generateAccessToken({ userId: newUser._id, email: newUser.email })
    const refreshToken = await generateRefreshToken({ userId: newUser._id, email: newUser.email })

    res.status(201).json({
      message: 'Login with Google successful',
      user: newUser.toObject(),
      accessToken,
      refreshToken
    })
  } else {
    if (!user.isGoogleAccount) {
      throw new ApiError(400, 'Please login with email and password')
    }

    delete user._doc.password
    delete user._doc.isActive
    delete user._doc.isAdmin

    const accessToken = await generateAccessToken({ userId: user._id, email: user.email })
    const refreshToken = await generateRefreshToken({ userId: user._id, email: user.email })

    res.status(200).json({
      message: 'Login with Google successful',
      user: user.toObject(),
      accessToken,
      refreshToken
    })
  }
})

export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const refreshToken = req.body?.refreshToken

  const decoded = await verifyRefreshToken(refreshToken)

  const accessToken = await generateAccessToken({ userId: decoded.userId, email: decoded.email })

  res.status(200).json({
    accessToken
  })
})

export const checkAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser) {
    throw new ApiError(404, 'User not found')
  }

  delete currentUser._doc.isActive
  delete currentUser._doc.isAdmin

  res.status(200).json({
    user: currentUser
  })
})

// admin only
export const updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser?.isAdmin) {
    throw new ApiError(403, 'Not authorized to delete category')
  }

  const { userId } = req.body

  if (!userId) {
    throw new ApiError(400, 'Please provide userId')
  }

  const user = await User.findByIdAndUpdate(userId, req.body, { new: true, runValidators: true })

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  res.status(200).json({
    message: 'User updated',
    user: user.toObject()
  })
})

export const updateMyProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  if (!currentUser) {
    throw new ApiError(404, 'User not found')
  }

  const { name, firstName, lastName, phoneNumber, address } = req.body

  if (name) {
    currentUser.name = name
  }

  if (firstName) {
    currentUser.firstName = firstName
  }

  if (lastName) {
    currentUser.lastName = lastName
  }

  if (phoneNumber) {
    currentUser.phoneNumber = phoneNumber
  }

  if (address) {
    currentUser.address = address
  }

  await currentUser.save()

  res.status(200).json({
    message: 'Profile updated',
    user: currentUser.toObject()
  })
})

export const updateMyPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {})
