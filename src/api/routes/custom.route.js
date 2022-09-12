const express = require('express')
const controller = require('../controllers/custom.controller')
// const keyVerify = require('../middlewares/keyCheck')
// const loginVerify = require('../middlewares/loginCheck')

const router = express.Router()
// router.route('/init').get(controller.init)
router.route('/status-sessao').get(controller.status)
router.route('/numeros').get(controller.numeros)
router.route('/disparo').post(controller.disparo)


module.exports = router
