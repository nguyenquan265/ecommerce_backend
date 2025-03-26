import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SENDGRID_HOST,
  port: process.env.SENDGRID_PORT,
  auth: {
    user: process.env.SENDGRID_USERNAME,
    pass: process.env.SENDGRID_PASSWORD
  }
} as nodemailer.TransportOptions)
