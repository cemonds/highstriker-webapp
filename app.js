var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require('underscore')._;
var locale = require("locale");
var app = express();

var GAME_MAX_DURATION = 30000;
var AFTER_GAME_WAIT_DURATION = 10000;
var CHECK_TIMEOUT_INTERVAL = 1000;
var NEXT_GAME_INTERVAL = 5000;
var IDLE_THRESHOLD = 30000;
var IDLE_CHECK_INTERVAL = 15000;

var supportedLocales = ["en", "en_US", "de", "de_DE"];

var waitingQueue = []
var currentGame = null;
var gameHistory = [];
var highScores = [];
var idleSounds = [];
var resultSounds = {};

var resultLines = {
	"de": {
		"default": "{0} - Netter Versuch, Kumpel.",
		"20": "hahahahaha - {0} - Den hätte meine Oma besser gemacht.",
		"21": "hahahahaha - {0} - Den hätte meine Oma besser gemacht.",
		"22": "hahahahaha - {0} - Den hätte meine Oma besser gemacht.",
		"23": "Nur {0}? Heute deinen Spinat vergessen?",
		"24": "Nur {0}? Heute deinen Spinat vergessen?",
		"25": "{0}. Gibt es hier auch Leute mit etwas Kraft?",
		"25": "{0}. Gibt es hier auch Leute mit etwas Kraft?",
		"26": "{0}. Gibt es hier auch Leute mit etwas Kraft?",
		"27": "{0}. Immerhin mal ein Anfang.",
		"28": "{0}. Immerhin mal ein Anfang.",
		"29": "Das kannst du aber besser, {0}. ",
		"30": "Das kannst du aber besser, {0}. ",
		"34": "So langsam wird es mit {0} Punkten. ",
		"35": "{0} Punkte, interessant. ",
		"36": "{0} Versuch mal den anderen Arm. ",
		"37": "Wooohoooo, was war das? {0} Punkte?",
		"38": "{0} Da kann ja einer etwas.",
		"39": "Nicht schlecht, {0}.",
		"40": "OK, {0}, das macht mir etwas Angst..",
		"43": "Wow, echt beeindruckend. {0} Punkte."
	},
	"en": {
		"default": "{0} - Nice try, buddy.",
		"20": "hahahahaha - {0} - My grandma would have done better.",
		"21": "hahahahaha - {0} - My grandma would have done better.",
		"22": "hahahahaha - {0} - My grandma would have done better.",
		"23": "Only {0}? Forgot to eat your spinach?",
		"24": "Only {0}? Forgot to eat your spinach?",
		"25": "{0}. Is here somebody with any strength?",
		"25": "{0}. Is here somebody with any strength?",
		"26": "{0}. Is here somebody with any strength?",
		"27": "{0}. At least a start.",
		"28": "{0}. At least a start.",
		"29": "You can do better, {0}. ",
		"30": "You can do better, {0}. ",
		"34": "You're getting there, a score of {0}. ",
		"35": "{0}, interesting. ",
		"36": "{0}. Try the other arm. ",
		"37": "Wooohoooo, what happend there? A score of {0}?",
		"38": "{0} There is somebody who knows what to do.",
		"39": "Not bad, {0}.",
		"40": "OK, {0}, I'm a little bit frightened.",
		"43": "Wow, impressive. A score of {0}."
	}
};

var fs = require('fs');

if (fs.existsSync('./highscore.json')) {
	var loadedData = require('./highscore.json');
	if(loadedData) {
		gameHistory = loadedData.gameHistory;
		highScores = loadedData.highScores;
	}
}

fs.readdir('sounds/idle', function(err, files){
	for(var i=0; i<files.length; ++i) {
		var file = files[i];
		if(file != 'README.txt') {
			idleSounds.push(file);
		}
	}
});

fs.readdir('sounds/result', function(err, files){
	for(var i=0; i<files.length; ++i) {
		var file = files[i];
		if(file != 'README.txt') {
			var file_name = path.basename(file, path.extname(file));
			var myRegexp = /(\d*)-(\d*)/g;
			var match = myRegexp.exec(file_name);
			if(match) {
				var start = 0;
				var end = 60;
				if(match[1]) {
					start = Number(match[1]);
				}
				if(match[2]) {
					end = Number(match[2]);
				}
				for(var number=start; number <= end; ++number) {
					resultSounds[number] = file;
				}
			}
		}
	}
});

var router = express.Router();

/* GET instructions. */
router.get('/', function(req, res) {
  console.log(req.locale);
  res.render('index.html', { locale: req.locale });
});

app.use(locale(supportedLocales));
app.use('/', router);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

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
		
		var showGameResult = function(game, playerLocale) {
			if(playerLocale == "de" || playerLocale == "de_DE") {
				playerLocale = "de";
			} else {
				playerLocale = "en";
			} 
			var exec = require('child_process').exec;
			var resultInteger = Math.floor(game.result);
			if(resultSounds[resultInteger]) {
				exec('mplayer -af volnorm=2:1 sounds/result/'+resultSounds[resultInteger]);
			}
			console.log(resultLines[playerLocale]);
			var line = resultLines[playerLocale][resultInteger];
			if(! line) {
				line = resultLines[playerLocale]['default'];
			}
			exec('espeak -v'+playerLocale+'+m1 -a400  -k4 -p20 -s -s200 -w /tmp/text.wav "'+line.replace('{0}', Math.floor(game.result*10)/10)+'" && aplay /tmp/text.wav');
			exec('python ledstrip/highstriker.py '+Math.floor(game.result));
			if(game.result > 40) {
				exec('echo "1" > /sys/class/gpio/gpio15/value');
				setTimeout(function() {
					exec('echo "0" > /sys/class/gpio/gpio15/value');
				}, game.result*50);
			}
		};

		var checkIdle = function() {
			if(waitingQueue.length == 0 && 
				(gameHistory.length == 0 ||
				gameHistory[gameHistory.length-1].end + IDLE_THRESHOLD < new Date().getTime())) {
				
				var exec = require('child_process').exec;
				exec('python ledstrip/idle.py');
				if(idleSounds.length  > 0) {
					var sound = idleSounds[Math.floor(Math.random()*idleSounds.length)];
					console.log("Playing sound "+sound);
					exec('mplayer -af volnorm=2:1 sounds/idle/'+sound);
				}
			}
		};

		setInterval(checkCurrentGameTimeout, CHECK_TIMEOUT_INTERVAL);
		setInterval(tryNextGame, NEXT_GAME_INTERVAL);
		setInterval(checkIdle, IDLE_CHECK_INTERVAL);

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
				exec('mplayer -af volnorm=2:1 /opt/highstriker-webapp/sounds/countdown.mp3');
/*				setTimeout(function() {
					exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_1.jpg');
					setTimeout(function() {
						exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_2.jpg');
						setTimeout(function() {
							exec('fswebcam -r 640x480 -S 4 --save /opt/highstriker-webapp/public/images/'+currentGame.id+'_3.jpg');
						}, 800);
					}, 800);
				}, delay-400);
*/
			});
			socket.on('finish-game', function(game) {
				if(currentGame && currentGame.player == socket.id && currentGame.id == game.id) {
					var currentTime = new Date().getTime();
					if(currentGame.end >= currentTime && currentGame.start <= currentTime) {
						currentGame.result = game.result;
						showGameResult(currentGame, game.locale);
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
