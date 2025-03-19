const calculatePrice = (price: number, discount?: number) =>
  discount ? Math.round(price * (1 - discount / 100)) : price

export default calculatePrice
