var app = angular.module('highstriker', ['ngRoute','ngTouch','ngCookies']);

app.config(['$routeProvider', function($routeProvider) {
	$routeProvider.
		when('/', {
			templateUrl: 'index',
			controller: 'IndexController'
		}).
		when('/queue', {
			templateUrl: 'queue',
			controller: 'QueueController'
		}).
		when('/game', {
			templateUrl: 'game',
			controller: 'GameController'
		}).
		when('/notsupported', {
			templateUrl: 'notsupported',
			controller: 'NotSupportedController'
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
	if (window.DeviceMotionEvent) {
		console.log("DeviceMotionEvent is supported");
	}

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
	socket.on('game-finish', function(message) {
		$scope.game = null;
		$location.url('/');
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
}]);

app.controller('NotSupportedController', ['$scope', 'socket', function ($scope, socket) {
	
}]);

app.controller('IndexController', ['$scope', 'socket', function ($scope, socket) {
	
}]);

app.controller('QueueController', ['$scope', 'socket', function ($scope, socket) {
	$scope.isInQueue = true;
	$scope.position = 0;
	$scope.waitingTime = 0;
	socket.emit('query-queue-status');
	socket.on('queue-status', function(status) {
		$scope.isInQueue = status.inQueue;
		if(status.inQueue) {
			$scope.position = status.position;
			$scope.waitingTime = status.waitingTime;
		} else {
			$scope.position = '-';
			$scope.waitingTime = '-';
		}
	});
}]);

app.controller('GameController', ['$scope', '$interval', 'socket', function ($scope, $interval, socket) {
	var COUNTDOWN_DURATION = 5000;
	var ARMED_DURATION = 3000;
	$scope.isArmed = false
	$scope.canStart = true;
	$scope.isStarted = false;
	$scope.startTime = null;
	$scope.gameCountdown = 0;
	$scope.startCountdown = 0;
	$scope.isFinished = false;
	$scope.maxAcceleration = 0;
	var durationOfGame = ($scope.game.end - $scope.game.start) / 1000;
	var gameEnding = new Date().getTime() + durationOfGame * 1000;
	var promise = null;
	var updateAcceleration = function (eventData) {
		if($scope.isArmed) {
			var acceleration = eventData.acceleration;
			$scope.maxAcceleration = Math.max($scope.maxAcceleration, Math.sqrt(acceleration.x*acceleration.x+acceleration.y*acceleration.y+acceleration.z*acceleration.z));
		}
	};
	
	if (window.DeviceMotionEvent) {
		window.addEventListener('devicemotion', updateAcceleration, false);
	}
	
	var updateCountdowns = function() {
		var currentTime = new Date().getTime();
		$scope.gameCountdown = gameEnding - currentTime;
		$scope.canStart = $scope.gameCountdown > COUNTDOWN_DURATION;
		if($scope.isStarted) {
			$scope.startCountdown = $scope.startTime - currentTime;
			if($scope.startCountdown < 0) {
				if($scope.startCountdown > - ARMED_DURATION) {
					$scope.isArmed = true;
				} else {
					$scope.isFinished = true;
					$scope.isArmed = false;
					socket.emit('finish-game', $scope.maxAcceleration);
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
		updateCountdowns();
	};
	
	promise = $interval(updateCountdowns, 100);
	$scope.$on('$destroy', function() {
		if(promise) {
			$interval.cancel(promise);
			promise = null;
		}
		window.addRemoveListener('devicemotion', updateAcceleration, false);
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