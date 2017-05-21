var express = require('express');
var router = express.Router();
var { hostName } = require('../lib/constants');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { redirectUri: hostName + '/login' });
});

module.exports = router;
