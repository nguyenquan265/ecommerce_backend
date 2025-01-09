import { sign, verify } from 'jsonwebtoken'

const generateAccessToken = ({ userId, email }: { userId: string; email: string }) => {
  try {
    return sign({ userId, email }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: 5 })
  } catch (error: any) {
    throw new Error(error)
  }
}

const generateRefreshToken = ({ userId, email }: { userId: string; email: string }) => {
  try {
    return sign({ userId, email }, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: '7 days' })
  } catch (error: any) {
    throw new Error(error)
  }
}

const verifyAccessToken = (accessToken: string) => {
  try {
    return verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string) as { userId: string; email: string }
  } catch (error: any) {
    throw new Error(error)
  }
}

const verifyRefreshToken = (refreshToken: string) => {
  try {
    return verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { userId: string; email: string }
  } catch (error: any) {
    throw new Error(error)
  }
}

export { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken }
