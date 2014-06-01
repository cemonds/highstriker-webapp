var express = require('express');
var router = express.Router();

/* GET queue. */
router.get('/', function(req, res) {
  res.render('queue', { title: 'Express' });
});

module.exports = router;
