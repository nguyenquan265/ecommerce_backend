import 'dotenv/config'

import app from './app'
import connectEcommerceDB from './config/ecommerce/db'

const PORT = process.env.PORT || 3000

app.listen(PORT, async () => {
  await connectEcommerceDB()

  console.log(`Server is running on port ${PORT}`)
})
