var app = angular.module('highstriker', ['ngRoute','ngTouch','ngCookies']);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider.
    when('/', {
      templateUrl: 'index',
      controller: 'IndexController'
    }).
    when('/inqueue', {
      templateUrl: 'inqueue',
      controller: 'InQueueController'
    }).
    otherwise({
      redirectTo: '/'
    });
}]);

app.controller('IndexController', ['$scope', 'socket', function ($scope, socket) {
  $scope.isInQueue = false;
  $scope.position = 0;
  $scope.queueJoinTime = null;
  $scope.joinQueue = function() {
    
  }
  $scope.leaveQueue = function() {
    
  }
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