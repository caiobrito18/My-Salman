const express = require('express');
const controller = require('../controllers/custom.controller');
// const keyVerify = require('../middlewares/keyCheck')
// const loginVerify = require('../middlewares/loginCheck')

const router = express.Router();
// router.route('/init').get(controller.init)
router.route('/status-sessao').get(controller.status);
router.route('/numeros').post(controller.numeros);
router.route('/disparo').post(controller.disparo);
router.route('/states').get(controller.states);
router.route('/cids').post(controller.cidades);
router.route('/campanha').post(controller.campaings.create);
router.route('/campanha/update').post(controller.campaings.update);
router.route('/campanha').get(controller.campaings.get);
router.route('/chatwoot/:session').post(controller.chatwoot);


module.exports = router;
