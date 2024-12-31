import { sign, verify } from 'jsonwebtoken'

const generateAccessToken = (userId: string) => {
  return sign({ userId }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: '30m' })
}

const generateRefreshToken = (userId: string) => {
  return sign({ userId }, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: '7d' })
}

const verifyAccessToken = (accessToken: string) => {
  return verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string) as { userId: string }
}

const verifyRefreshToken = (refreshToken: string) => {
  return verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { userId: string }
}

export { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken }
