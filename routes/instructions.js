var express = require('express');
var router = express.Router();

/* GET instructions. */
router.get('/', function(req, res) {
  res.render('instructions', { title: 'Express' });
});

module.exports = router;
