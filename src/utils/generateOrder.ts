import moment from 'moment'
import crypto from 'crypto'
import CryptoJS from 'crypto-js'

import ZaloConfig from '../config/ecommerce/zalo'
import MomoConfig from '../config/ecommerce/momo'

export const generateZaloOrder = (totalPrice: number, userId: string, cartId: string) => {
  const transID = Math.floor(Math.random() * 1000000)
  const zaloOrder = {
    app_id: ZaloConfig.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
    app_user: 'user123',
    app_time: Date.now(),
    item: JSON.stringify([{}]),
    embed_data: JSON.stringify({ redirecturl: `${process.env.CLIENT_URL}/account/orders` }),
    amount: totalPrice,
    description: `Thanh toán đơn hàng #${transID}`,
    bank_code: '',
    callback_url: `${process.env.SERVER_URL}/api/ecommerce/orders/zalo-callback?userId=${userId}&cartId=${cartId}`, // npx cloudflared tunnel --url http://localhost:8000
    mac: ''
  }

  const data = `${ZaloConfig.app_id}|${zaloOrder.app_trans_id}|${zaloOrder.app_user}|${zaloOrder.amount}|${zaloOrder.app_time}|${zaloOrder.embed_data}|${zaloOrder.item}`
  zaloOrder.mac = CryptoJS.HmacSHA256(data, ZaloConfig.key1).toString()

  return zaloOrder
}

export const generateMomoOrder = (totalPrice: number, userId: string, cartId: string) => {
  //parameters
  const accessKey = MomoConfig.accessKey
  const secretKey = MomoConfig.secretKey
  const orderInfo = 'pay with MoMo'
  const partnerCode = MomoConfig.partnerCode
  const redirectUrl = `${process.env.CLIENT_URL}/account/orders`
  const ipnUrl = `${process.env.SERVER_URL}/api/ecommerce/orders/momo-callback?userId=${userId}&cartId=${cartId}` // npx cloudflared tunnel --url http://localhost:8000
  const requestType = 'payWithMethod'
  const amount = totalPrice
  const orderId = partnerCode + new Date().getTime()
  const requestId = orderId
  const extraData = ''
  const orderGroupId = ''
  const autoCapture = true
  const lang = 'vi'

  //before sign HMAC SHA256 with format
  const rawSignature =
    'accessKey=' +
    accessKey +
    '&amount=' +
    amount +
    '&extraData=' +
    extraData +
    '&ipnUrl=' +
    ipnUrl +
    '&orderId=' +
    orderId +
    '&orderInfo=' +
    orderInfo +
    '&partnerCode=' +
    partnerCode +
    '&redirectUrl=' +
    redirectUrl +
    '&requestId=' +
    requestId +
    '&requestType=' +
    requestType
  //signature
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')

  //json object send to MoMo endpoint
  const requestBody = JSON.stringify({
    partnerCode: partnerCode,
    partnerName: 'Test',
    storeId: 'MomoTestStore',
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    redirectUrl: redirectUrl,
    ipnUrl: ipnUrl,
    lang: lang,
    requestType: requestType,
    autoCapture: autoCapture,
    extraData: extraData,
    orderGroupId: orderGroupId,
    signature: signature
  })

  // options for axios
  const options = {
    method: 'POST',
    url: 'https://test-payment.momo.vn/v2/gateway/api/create',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    },
    data: requestBody
  }

  return options
}
