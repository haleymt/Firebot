var express = require('express');
var router = express.Router();
var { hostName } = require('../lib/constants');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { redirectUri: hostName + '/login' });
});

/* POST Events API response */

router.post('/slack/receive', function(req, res) {
  res.status(200);
  res.json({ challenge: req.body.challenge});
})

module.exports = router;
