import { sign, verify } from 'jsonwebtoken'

const generateAccessToken = async ({ userId, email }: { userId: string; email: string }) => {
  try {
    return sign({ userId, email }, process.env.ACCESS_TOKEN_SECRET!, { algorithm: 'HS256', expiresIn: '30m' })
  } catch (error: any) {
    throw new Error(error)
  }
}

const generateRefreshToken = async ({ userId, email }: { userId: string; email: string }) => {
  try {
    return sign({ userId, email }, process.env.REFRESH_TOKEN_SECRET!, { algorithm: 'HS256', expiresIn: '14d' })
  } catch (error: any) {
    throw new Error(error)
  }
}

const verifyAccessToken = async (accessToken: string) => {
  try {
    return verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string) as { userId: string; email: string }
  } catch (error: any) {
    throw new Error(error)
  }
}

const verifyRefreshToken = async (refreshToken: string) => {
  try {
    return verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { userId: string; email: string }
  } catch (error: any) {
    throw new Error(error)
  }
}

export { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken }
