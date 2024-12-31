class ApiError extends Error {
  errorMsg: string
  statusCode: number
  isOperational: boolean

  constructor(statusCode: number, errorMsg: string) {
    super(errorMsg)

    this.errorMsg = errorMsg
    this.statusCode = statusCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

export default ApiError
