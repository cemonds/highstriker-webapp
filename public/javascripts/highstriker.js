var app = angular.module('highstriker', ['ngRoute','ngTouch','ngCookies']);

app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.
		when('/', {
			templateUrl: 'main.html',
			controller: 'IndexController'
		}).
		when('/queue', {
			templateUrl: 'queue.html',
			controller: 'QueueController'
		}).
		when('/game', {
			templateUrl: 'game.html',
			controller: 'GameController'
		}).
		when('/result', {
			templateUrl: 'result.html',
			controller: 'ResultController'
		}).
		when('/highscore', {
			templateUrl: 'highscore.html',
			controller: 'HighScoreController'
		}).
		when('/instructions', {
			templateUrl: 'instructions.html'
		}).
		when('/notsupported', {
			templateUrl: 'notsupported.html'
		}).
		otherwise({
			redirectTo: '/'
		});
}]);

app.controller('MainController', ['$scope', '$location', 'socket', function ($scope, $location, socket) {
	$scope.isInQueue = false;
	$scope.position = 0;
	$scope.queueJoinTime = null;
	$scope.connectedUsers = -1;
	$scope.waitingUsers = -1;
	$scope.game = null;
	$scope.lastGame = null;
	$scope.highScores = []
	
	if (!window.DeviceMotionEvent) {
		$location.url('/notsupported');
	}
	socket.on('highscore', function(highScores) {
		$scope.highScores = highScores;
	});
	socket.on('status', function(message) {
		$scope.connectedUsers = message.connectedUsers;
	});
	socket.on('queue-joined', function(message) {
		$scope.isInQueue = true
		$location.url('/queue');
	});
	socket.on('queue-left', function(message) {
		$scope.isInQueue = false
		$location.url('/');
	});
	socket.on('game-ready', function(message) {
		$scope.isInQueue = false
		$scope.game = message;
		$location.url('/game');
	});
	socket.on('game-timeout', function(message) {
		$scope.game = null;
		$location.url('/');
	});
	socket.on('game-finished', function(message) {
		$scope.lastGame = $scope.game;
		$scope.game = null;
		$location.url('/result');
	});
	socket.on('status', function(message) {
		$scope.connectedUsers = message.connectedUsers;
		$scope.waitingUsers = message.waitingUsers;
	});
	$scope.joinQueue = function() {
		socket.emit('join-queue');
	}
	$scope.leaveQueue = function() {
		socket.emit('leave-queue');
	}
	$scope.showInstructions = function() {
		$location.url('/instructions');
	}
	$scope.showHighScore = function() {
		$location.url('/highscore');
	}
	$scope.goBack = function() {
		window.history.back();
	}
	$scope.goMain = function() {
		$location.url('/');
	}
}]);

app.controller('IndexController', ['$scope', 'socket', function ($scope, socket) {
	
}]);

app.controller('HighScoreController', ['$scope', 'socket', function ($scope, socket) {
	socket.emit('query-highscore');
}]);

app.controller('QueueController', ['$scope', 'socket', function ($scope, socket) {
	$scope.isInQueue = true;
	$scope.position = 0;
	$scope.waitingTime = 0;
	var onQueueStatus = function(status) {
		$scope.isInQueue = status.inQueue;
		if(status.inQueue) {
			$scope.position = status.position;
			$scope.waitingTime = status.waitingTime;
		} else {
			$scope.position = '-';
			$scope.waitingTime = '-';
		}
	};
	socket.on('queue-status', onQueueStatus);
	socket.emit('query-queue-status');
	
	$scope.$on('$destroy', function() {
		socket.removeListener('queue-status', onQueueStatus);
	});
}]);

app.controller('GameController', ['$scope', '$interval', '$location', 'socket', function ($scope, $interval, $location, socket) {
	var COUNTDOWN_DURATION = 5000;
	var ARMED_DURATION = 3000;
	$scope.isArmed = false
	$scope.canStart = true;
	$scope.isStarted = false;
	$scope.startTime = null;
	$scope.timeUntilGameTimeout = 0;
	$scope.gameCountdown = 0;
	$scope.timeUntilStart = 0;
	$scope.startCountdown = 0;
	$scope.isFinished = false;
	$scope.maxAcceleration = 0;
	if(!$scope.game) {
		$location.url('/');
	}
	var durationOfGame = ($scope.game.end - $scope.game.start) / 1000;
	var gameEnding = new Date().getTime() + durationOfGame * 1000;
	var promise = null;
	var updateAcceleration = function (eventData) {
		if($scope.isArmed) {
			var acceleration = null;
			if(eventData.acceleration) {
				acceleration = eventData.acceleration;
				$scope.maxAcceleration = Math.max($scope.maxAcceleration, Math.sqrt(acceleration.x*acceleration.x+acceleration.y*acceleration.y+acceleration.z*acceleration.z));
			} else {
				acceleration = eventData.accelerationIncludingGravity;
				$scope.maxAcceleration = Math.max($scope.maxAcceleration, Math.sqrt(acceleration.x*acceleration.x+acceleration.y*acceleration.y+acceleration.z*acceleration.z)-9.8);
			}
		}
	};
	
	if (window.DeviceMotionEvent) {
		window.addEventListener('devicemotion', updateAcceleration, false);
	}
	
	var updateCountdowns = function() {
		var currentTime = new Date().getTime();
		$scope.timeUntilGameTimeout = gameEnding - currentTime;
		$scope.canStart = $scope.timeUntilGameTimeout > COUNTDOWN_DURATION;
		if($scope.isStarted) {
			$scope.timeUntilStart = $scope.startTime - currentTime;
			$scope.startCountdown = Math.floor(($scope.timeUntilStart+999)/1000);
			if($scope.timeUntilStart < 0) {
				if($scope.timeUntilStart > - ARMED_DURATION) {
					$scope.isArmed = true;
				} else {
					$scope.isFinished = true;
					$scope.isArmed = false;
					$scope.game.result = $scope.maxAcceleration;
					socket.emit('finish-game', $scope.game);
					if(promise) {
						$interval.cancel(promise);
						promise = null;
					}
				}
			}
		}
	};

	$scope.start = function() {
		$scope.isStarted = true;
		$scope.startTime = new Date().getTime() + COUNTDOWN_DURATION;
		socket.emit('game-will-start', COUNTDOWN_DURATION);
		updateCountdowns();
	};
	
	promise = $interval(updateCountdowns, 100);
	$scope.$on('$destroy', function() {
		if(promise) {
			$interval.cancel(promise);
			promise = null;
		}
		window.removeEventListener('devicemotion', updateAcceleration, false);
	});
}]);

app.controller('ResultController', ['$scope', '$cookies', '$location', 'socket', function ($scope, $cookies, $location, socket) {
	if(!$scope.lastGame) {
		$location.url('/');
	}
	$scope.name = $cookies.name;
	$scope.estimatedPosition = function() {
		var i=0;
		for(i=0; i<$scope.highScores.length; ++i) {
			if($scope.highScores[i].result < $scope.lastGame.result) {
				break;
			}
		}
		return i+1;
	};
	$scope.submitHighScore = function() {
		var highScore = {game:$scope.lastGame.id,result:$scope.lastGame.result,name:$scope.name};
		$cookies.name = $scope.name;
		socket.emit('add-highscore', highScore);
	};
	var onHighscoreAdded = function() {
		$location.url('/highscore');
	};
	socket.on('highscore-added', onHighscoreAdded);
	
	socket.emit('query-highscore');
	
	$scope.$on('$destroy', function() {
		socket.removeListener('highscore-added', onHighscoreAdded);
	});
}]);

app.factory('socket', ['$rootScope', function ($rootScope) {
	var socket = io.connect();
	return {
		on: function (eventName, callback) {
			socket.on(eventName, function () {	
				var args = arguments;
				$rootScope.$apply(function () {
					callback.apply(socket, args);
				});
			});
		},
		removeListener: function (eventName, callback) {
			// TODO Remove doesn't work, since the real callback
			// is wrapped by an anonymous function when registered 
			// Here is a potential memory leak
		},
		emit: function (eventName, data, callback) {
			socket.emit(eventName, data, function () {
				var args = arguments;
				$rootScope.$apply(function () {
					if (callback) {
						callback.apply(socket, args);
					}
				});
			})
		}
	};
}]);

app.filter('i18n', ['localizedTexts', '$locale', function (localizedTexts, $locale) {
	return function (text) {
		if (localizedTexts.hasOwnProperty(text)) {
			var textTranslations = localizedTexts[text];
			if(textTranslations.hasOwnProperty($locale.id)) {
				return textTranslations[$locale.id];
			}
			var language = /([a-zA-Z]+)-[a-zA-Z]+/.exec($locale.id)[1];
			if(textTranslations.hasOwnProperty(language)) {
				return textTranslations[language];
			}
		}
		return text;
	};
}])

// this can be in a seperate file, but should load after the filter is loaded
app.value('localizedTexts', {
	'Welcome to Highstriker mobile!': {'de': 'Willkommen bei Highstriker mobile!'},
	'edit Carte': {'de': 'Karte bearbeiten'},
	'Status': {'de': 'Status'},
	'Not in queue': {'de': 'Nicht in Warteschlange'},
	'In queue': {'de': 'In Warteschlange'},
	'Active players:': {'de': 'Aktive Spieler'},
	'Players in queue:': {'de': 'Spieler in Warteschlange'},
	'Not supported': {'de': 'Nicht unterstützt'},
	'Unfortunately your device doesn\'t provide the needed APIs for reading the acceleration data. We\'re terrible sorry. :-(': {'de': 'Unglücklicherweise unterstützt dein Gerät nicht die benötigten Funktionen um die Beschleunigung zu messen. Es tut uns sehr leid. :-('},
	'How to play': {'de': 'Wie spielt man'},
	'High score': {'de': 'Bestenliste'},
	'Back': {'de': 'Zurück'},
	'Play!': {'de': 'Spielen!'},
	'GO!': {'de': 'LOS!'},
	'Start': {'de': 'Start'},
	'Time remaining:': {'de': 'Verbleibende Zeit:'},
	'Waiting...': {'de': 'Warte...'},
	'Current position in queue:': {'de': 'Aktuelle Position in Warteschlange:'},
	'Estimated waiting time:': {'de': 'Geschätzte Wartezeit:'},
	'Leave the queue': {'de': 'Warteschlange verlassen'},
	'You are currently not waiting for a game.': {'de': 'Du wartest grade nicht auf ein Spiel.'},
	'Join the queue': {'de': 'Warteschlange beitreten'},
	'Cancel': {'de': 'Abbrechen'},
	'Result': {'de': 'Ergebnis'},
	'Score': {'de': 'Punkte'},
	'Position in high score': {'de': 'Position in Bestenliste'},
	'Submit to high score': {'de': 'In Bestenliste eintragen'},
	'Your name': {'de': 'Dein Name'},
	'Submit': {'de': 'Eintragen'},
	'Skip it': {'de': 'Überspringen'}
});