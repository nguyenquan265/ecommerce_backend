import { MailtrapClient } from 'mailtrap'

const TOKEN = process.env.MAILTRAP_TOKEN as string

export const mailtrapClient = new MailtrapClient({ token: TOKEN })

export const sender = {
  email: 'mailtrap@demomailtrap.com',
  name: 'Authentication admin'
}
