var express = require('express');
var router = express.Router();
var { hostName } = require('../constants');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { redirectUri: hostName + '/oauth' });
});

module.exports = router;
