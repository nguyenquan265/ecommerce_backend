import { NextFunction, Request, Response } from 'express'
import { genSalt, hash } from 'bcryptjs'

import User from '~/models/ecommerce/user.model'

import ApiError from '~/utils/ApiError'
import asyncHandler from '~/utils/asyncHandler'

interface GetUsersRequest extends Request {
  query: {
    page?: string
    limit?: string
    searchString?: string
    sortBy?: 'asc' | 'desc' | 'a-z' | 'z-a'
  }
}

export const getAllUsers = asyncHandler(async (req: GetUsersRequest, res: Response, next: NextFunction) => {
  const { page = '1', limit = '10', searchString = '', sortBy = 'desc' } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const currentUser = await User.findById(req.decoded?.userId)

  let filter: any = currentUser?.isAdmin ? {} : { isActive: true, isAdmin: false }
  let sort: any = { createdAt: -1 }

  if (searchString) {
    const searchRegex = new RegExp(searchString, 'i')

    filter = {
      ...filter,
      $or: [{ name: searchRegex }, { email: searchRegex }]
    }
  }

  if (sortBy === 'asc') {
    sort = { createdAt: 1 }
  } else if (sortBy === 'a-z') {
    sort = { name: 1 }
  } else if (sortBy === 'z-a') {
    sort = { name: -1 }
  }

  const [totalUsers, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).skip(skip).limit(parseInt(limit)).sort(sort).lean()
  ])

  const totalPages = Math.ceil(totalUsers / parseInt(limit)) || 1

  res.status(200).json({
    message: 'Get users successfully',
    users,
    pagination: {
      totalUsers,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit)
    }
  })
})

export const getUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = await User.findById(req.decoded?.userId)

  const filter = currentUser?.isAdmin
    ? { _id: req.params.userId }
    : { _id: req.params.userId, isActive: true, isAdmin: false }

  const user = await User.findOne(filter).lean()

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  res.status(200).json({
    message: 'Get user successfully',
    user
  })
})

// admin only
export const createUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    name,
    email,
    password,
    phoneNumber,
    province,
    district,
    ward,
    address,
    provinceName,
    districtName,
    wardName,
    isAdmin,
    isActive,
    isGoogleAccount
  } = req.body
  const phoneReg = /^0\d{9}$/

  if (!name || !email || !password) {
    throw new ApiError(400, 'Please provide name, email and password')
  }

  const existedUser = await User.findOne({ email })

  if (existedUser) {
    throw new ApiError(400, 'Email already exists')
  }

  const salt = await genSalt(10)
  const hashedPassword = await hash(password, salt)
  let user: any

  if (phoneNumber && !phoneReg.test(phoneNumber)) {
    throw new ApiError(400, 'Invalid phone number')
  }

  if (province && provinceName) {
    const shippingAddress = {
      province,
      district,
      ward,
      address,
      provinceName,
      districtName,
      wardName
    }

    user = await User.create({
      name,
      email,
      password: hashedPassword,
      phoneNumber,
      shippingAddress,
      isAdmin,
      isActive,
      isGoogleAccount
    })
  } else {
    user = await User.create({
      name,
      email,
      password: hashedPassword,
      phoneNumber,
      isAdmin,
      isActive,
      isGoogleAccount
    })
  }

  res.status(201).json({
    message: 'Create user successfully',
    user
  })
})

// admin only
export const updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    name,
    email,
    password,
    phoneNumber,
    province,
    district,
    ward,
    address,
    provinceName,
    districtName,
    wardName,
    isActive,
    isAdmin
  } = req.body
  const phoneReg = /^0\d{9}$/

  if (!name || !email) {
    throw new ApiError(400, 'Please provide name and email')
  }

  const user = await User.findById(req.params.userId)

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  if (phoneNumber && !phoneReg.test(phoneNumber)) {
    throw new ApiError(400, 'Invalid phone number')
  }

  user.name = name
  user.email = email
  user.phoneNumber = phoneNumber
  user.isActive = isActive
  user.isAdmin = isAdmin

  if (password) {
    const salt = await genSalt(10)
    user.password = await hash(password, salt)
  }

  if (province && provinceName) {
    user.shippingAddress = {
      province,
      district,
      ward,
      address,
      provinceName,
      districtName,
      wardName
    }
  }

  await user.save()

  res.status(200).json({
    message: 'Update user successfully',
    user
  })
})

// admin only
export const deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findByIdAndDelete(req.params.userId)

  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  res.status(200).json({
    message: 'Delete user successfully',
    user
  })
})
