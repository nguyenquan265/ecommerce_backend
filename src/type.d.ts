import express from 'express'

declare module 'express' {
  interface Request {
    cookies: {
      refreshToken: string
    }
    userId?: string
  }
}
