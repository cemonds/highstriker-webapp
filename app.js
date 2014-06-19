var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require('underscore')._;

var app = express();

var GAME_MAX_DURATION = 30000;
var AFTER_GAME_WAIT_DURATION = 10000;
var CHECK_TIMEOUT_INTERVAL = 1000;
var NEXT_GAME_INTERVAL = 5000;

var waitingQueue = []
var currentGame = null;
var gameHistory = [];
var highScores = [];

var fs = require('fs');

if (fs.existsSync('./highscore.json')) {
	var loadedData = require('./highscore.json');
	if(loadedData) {
		gameHistory = loadedData.gameHistory;
		highScores = loadedData.highScores;
	}
}



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
		
		var showGameResult = function(game) {
			var exec = require('child_process').exec;
			exec('espeak -ven+m1 -a400  -k4 -p20 -s -s200 -w /tmp/text.wav "'+Math.floor(game.result*10)/10+' - Nice try, Buddy." && aplay /tmp/text.wav');
			exec('python ledstrip/highstriker.py '+Math.floor(game.result));
			if(game.result > 30) {
				exec('echo "1" > /sys/class/gpio/gpio15/value');
				setTimeout(function() {
					exec('echo "0" > /sys/class/gpio/gpio15/value');
				}, game.result*50);
			}
		};

		setInterval(checkCurrentGameTimeout, CHECK_TIMEOUT_INTERVAL);
		setInterval(tryNextGame, NEXT_GAME_INTERVAL);

		var addHighScore = function(highScore) {
			var position = highScores.length;
			for(var i=0; i < highScores.length; ++i) {
				comparison = highScores[i].result - highScore.result;
				if (comparison < 0) {
					position = i;
					break;
				} 
			}
			highScores.splice(position, 0, highScore);
			io.emit('highscore', highScores);
			var fs = require('fs');
			var outputFilename = './highscore.json';
			fs.writeFile(outputFilename, JSON.stringify({highScores:highScores,gameHistory:gameHistory}, null, 4), function(err) {
				if(err) {
					console.log(err);
				} else {
					console.log("JSON saved to " + outputFilename);
				}
			});
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
			socket.on('query-highscore', function() {
				socket.emit('highscore', highScores);
			});
			socket.on('start-game', function() {
				if(currentGame && currentGame.player == socket.id) {
					socket.emit('game-started');
				}
			});
			socket.on('game-will-start', function(delay) {
				var exec = require('child_process').exec;
				setTimeout(function() {
					exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_1.jpg');
					setTimeout(function() {
						exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_2.jpg');
						setTimeout(function() {
							exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_3.jpg');
							setTimeout(function() {
								exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_4.jpg');
								setTimeout(function() {
									exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_5.jpg');
								}, 500);
							}, 500);
						}, 500);
					}, 500);
				}, delay);
			});
			socket.on('finish-game', function(game) {
				if(currentGame && currentGame.player == socket.id && currentGame.id == game.id) {
					var currentTime = new Date().getTime();
					if(currentGame.end >= currentTime && currentGame.start <= currentTime) {
						currentGame.result = game.result;
						showGameResult(currentGame);
						gameHistory.push(currentGame);
						currentGame = null;
						socket.emit('game-finished');
					}
				}
			});
			socket.on('add-highscore', function(highScore) {
				var game = _.findWhere(gameHistory, {id:highScore.game,player:socket.id});
				if(game && game.result == highScore.result) {
					var oldHighScore = _.findWhere(gameHistory, {game:game.id});
					if(oldHighScore) {
						oldHighScore.name = highScore.name;
						io.emit('highscore', highScores);
					} else {
						addHighScore(highScore);
					}
					socket.emit('highscore-added');
				}
			});
		});

	}
};
