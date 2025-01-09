import { Router } from 'express'

import { authenticate } from '~/middlewares/ecommerce/auth.middleware'

const router = Router()

router.get('/')
router.post('/')
router.get('/:productId')
router.patch('/:productId')
router.delete('/:productId')

export default router
