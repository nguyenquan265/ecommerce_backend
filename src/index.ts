import 'dotenv/config'
import cron from 'node-cron'
import https from 'https'

import app from './app'
import connectEcommerceDB from './config/ecommerce/db'

const PORT = process.env.PORT || 3000
const URL = process.env.SERVER_URL_HEALTH as string

const ping = () => {
  https
    .get(URL, (res) => {
      if (res.statusCode === 200) {
        console.log('GET request sent successfully')
      } else {
        console.log('GET request failed', res.statusCode)
      }
    })
    .on('error', (e) => {
      console.error('Error while sending request', e)
    })
}

app.listen(PORT, async () => {
  await connectEcommerceDB()

  console.log(`Server is running on port ${PORT}`)
})

cron.schedule('*/3 * * * *', ping)
