var express = require('express');
var router = express.Router();

/* GET game. */
router.get('/', function(req, res) {
  res.render('game', { title: 'Express' });
});

module.exports = router;
