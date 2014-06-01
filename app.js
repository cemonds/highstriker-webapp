var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var app = express();

var GAME_MAX_DURATION = 30000;
var AFTER_GAME_WAIT_DURATION = 10000;
var CHECK_TIMEOUT_INTERVAL = 1000;
var NEXT_GAME_INTERVAL = 1000;

var waitingQueue = []
var currentGame = null;
var gameHistory = [];
var highScores = [];



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


var router = express.Router();

/* GET game. */
router.get('/', function(req, res) {
  res.render('layout', { highScores: highScores });
});
router.get('/index', function(req, res) {
  res.render('index', { highScores: highScores });
});
router.get('/game', function(req, res) {
  res.render('game', { highScores: highScores });
});
router.get('/queue', function(req, res) {
  res.render('queue', { highScores: highScores });
});
router.get('/highscore', function(req, res) {
  res.render('highscore', { highScores: highScores });
});
router.get('/instructions', function(req, res) {
  res.render('instructions', { highScores: highScores });
});
router.get('/notsupported', function(req, res) {
  res.render('notsupported', { highScores: highScores });
});
app.use('/', router);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = {
	start: function(port) {
		var debug = require('debug')('highstriker');
		var server = app.listen(port, function() {
			debug('Express server listening on port ' + server.address().port);
		});

		var io = require('socket.io')(server);

		var sendStatusUpdate = function() {
			var connectedSockets = Object.keys(io.sockets.connected).length;
			var waitingInQueue = waitingQueue.length;
			io.emit('status', {connectedUsers:connectedSockets, waitingUsers: waitingInQueue});
		};

		var sendQueueStatusUpdate = function(player) {
			var waitingInQueue = waitingQueue.length;
			for(var i=0; i<waitingQueue.length; ++i) {
				if(player == null || player == waitingQueue[i]) {
					io.sockets.connected[waitingQueue[i]].emit('queue-status', {inQueue:true, position:i+1, waitingTime: (i+1)*GAME_MAX_DURATION/1000});
				}
			}
		};

		var tryNextGame = function() {
			if(! currentGame && waitingQueue.length > 0) {
				nextPlayerId = waitingQueue.shift();
				var currentTime = new Date().getTime();
				currentGame = {player: nextPlayerId, id:currentTime, start:currentTime, end:currentTime + GAME_MAX_DURATION};
				io.sockets.connected[currentGame.player].emit('game-ready', currentGame);
				sendStatusUpdate();
				sendQueueStatusUpdate();
			}
		};

		var checkCurrentGameTimeout = function() {
			if(currentGame) {
				var currentTime = new Date().getTime();
				if(currentGame.end < currentTime) {
					io.sockets.connected[currentGame.player].emit('game-timeout', currentGame);
					currentGame.result = 'timeout';
					gameHistory.push(currentGame);
					currentGame = null;
				}
			}
		};

		setInterval(checkCurrentGameTimeout, CHECK_TIMEOUT_INTERVAL);
		setInterval(tryNextGame, NEXT_GAME_INTERVAL);

		var addHighScore = function(game) {
			var position = 0;
			for(var i=0; i < highScores.length - 1; ++i) {
				comparison = highScores[i] - result;
				if (comparison < 0) {
					position = i;
					break;
				} 
			}
			highScores.splice(position, 0, game);
		};

		io.on('connection', function(socket){
			sendStatusUpdate();	
			socket.on('join-queue', function () {
				if(waitingQueue.indexOf(socket.id) < 0) {
					waitingQueue.push(socket.id);
					socket.emit('queue-joined');
					sendStatusUpdate();	
				}
			});
			socket.on('leave-queue', function () {
				var pos = waitingQueue.indexOf(socket.id);
				if(pos >= 0) {
					waitingQueue.splice(pos, 1);
					socket.emit('queue-left');
					sendStatusUpdate();	
				}
			});
			socket.on('disconnect', function(){
				var pos = waitingQueue.indexOf(socket.id);
				if(pos >= 0) {
					waitingQueue.splice(pos, 1);
				}
				if(currentGame && currentGame.player == socket.id) {
					currentGame.result = 'abandoned';
					gameHistory.push(currentGame);
					currentGame = null;
				}
				sendStatusUpdate();	
			});
			socket.on('query-queue-status', function() {
				var pos = waitingQueue.indexOf(socket.id);
				if(pos >= 0) {
					sendQueueStatusUpdate(socket.id);
				} else {
					socket.emit('queue-status', {inQueue:false});
				}
			});
			socket.on('start-game', function() {
				if(currentGame && currentGame.player == socket.id) {
					socket.emit('game-started');
				}
			});
			socket.on('finish-game', function(result) {
				if(currentGame && currentGame.player == socket.id) {
					var currentTime = new Date().getTime();
					if(currentGame.end >= currentTime && currentGame.start <= currentTime) {
						console.log("Result "+result);
						currentGame.result = result;
						gameHistory.push(currentGame);
						addHighScore(currentGame);
						currentGame = null;
						socket.emit('game-finished');
					}
				}
			});
		});

	}
};