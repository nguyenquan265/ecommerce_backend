import express from 'express'

declare module 'express' {
  interface Request {
    decoded?: {
      userId: string
      email: string
    }
  }
}
