/// <reference path="/Scripts/FabricUI/MessageBanner.js" />
Parse.initialize("lIPQqClBkGvd78SS5OBG2Tc8H9mKNjRKYo8oqe1u", "CnzMmHCl8YVAR2v1RypHudGbB9mrKz9R42d7TWMS");
Parse.serverURL = 'https://powerp.back4app.io/';
// piw23106@tqosi.com


(function (window, undef) {

    var angular = window.angular;

    if (angular !== undef) {

        var module = angular.module('parse-angular', []);

        module.run(['$q', '$window', '$rootScope', function ($q, $window, $rootScope) {
            // Process only if Parse exist on the global window, do nothing otherwise
            if (Parse) {


                //-------------------------------------
                // Structured object of what we need to update
                //-------------------------------------

                var methodsToUpdate = {
                    "Object": {
                        prototype: ['save', 'fetch', 'destroy'],
                        static: ['saveAll', 'destroyAll']
                    },
                    "Query": {
                        prototype: ['find', 'first', 'count'],
                        static: []
                    },
                    "Cloud": {
                        prototype: [],
                        static: ['run']
                    },
                    "User": {
                        prototype: ['signUp', 'logIn'],
                        static: ['requestPasswordReset']
                    },
                    "FacebookUtils": {
                        prototype: [],
                        static: ['logIn', 'link', 'unlink']
                    },
                    "Config": {
                        prototype: [],
                        static: ['get']
                    }
                };
                var loadingMethods = ['save', 'signUp', 'logIn', 'requestPasswordReset'];
                //// Let's loop over Parse objects
                for (var k in methodsToUpdate) {

                    var currentClass = k;
                    var currentObject = methodsToUpdate[k];

                    var currentProtoMethods = currentObject.prototype;
                    var currentStaticMethods = currentObject.static;

                    var rejectHandler = function (obj, err) {
                        var defer = $q.defer();
                        obj.code = obj.code || (err && err.code) || 100;
                        obj.message = obj.message || (err && err.message);
                        console.log(obj);
                        defer.reject(obj);
                        return defer.promise;
                    };

//                    /// Patching prototypes
                    currentProtoMethods.forEach(function (method) {

                        var origMethod = Parse[currentClass].prototype[method];

                        // Overwrite original function by wrapping it with $q
                        Parse[currentClass].prototype[method] = function () {
                            $rootScope.isLoading = true;
                            return origMethod.apply(this, arguments)
                                .then(function (data) {
                                    var defer = $q.defer();
                                    defer.resolve(data);
                                    $rootScope.isLoading = false;
                                    $rootScope.loadingProgress = false;
                                    return defer.promise;
                                }, function (obj, err) {
                                    $rootScope.isLoading = false;
                                    $rootScope.loadingProgress = false;
                                    return rejectHandler(obj, err);
                                });
                        };

                    });


                    //Patching static methods too
                    currentStaticMethods.forEach(function (method) {

                        var origMethod = Parse[currentClass][method];

                        // Overwrite original function by wrapping it with $q
                        Parse[currentClass][method] = function () {
                            $rootScope.isLoading = true;
                            return origMethod.apply(this, arguments)
                                .then(function (data) {
                                    var defer = $q.defer();
                                    defer.resolve(data);
                                    $rootScope.isLoading = false;
                                    $rootScope.loadingProgress = false;
                                    return defer.promise;
                                }, function (obj, err) {
                                    $rootScope.isLoading = false;
                                    $rootScope.loadingProgress = false;
                                    return rejectHandler(obj, err);
                                });
                        };

                    });


                }
            }

        }]);


        angular.module('parse-angular.enhance', ['parse-angular'])
            .run(['$q', '$window', function ($q, $window) {


                if (Parse) {


                    /// Create a method to easily access our object
                    /// Because Parse.Object("xxxx") is actually creating an object and we can't access static methods

                    Parse.Object.getClass = function (className) {
                        return Parse.Object._classMap[className];
                    };

                    ///// CamelCaseIsh Helper
                    function capitaliseFirstLetter(string) {
                        return string.charAt(0).toUpperCase() + string.slice(1);
                    }


                    ///// Override orig extend
                    var origObjectExtend = Parse.Object.extend;

                    Parse.Object.extend = function (protoProps) {

                        var newClass = origObjectExtend.apply(this, arguments);

                        if (Parse._ && Parse._.isObject(protoProps) && Parse._.isArray(protoProps.attrs)) {
                            var attrs = protoProps.attrs;
                            /// Generate setters & getters
                            Parse._.each(attrs, function (currentAttr) {

                                var field = capitaliseFirstLetter(currentAttr);

                                // Don't override if we set a custom setters or getters
                                if (!newClass.prototype['get' + field]) {
                                    newClass.prototype['get' + field] = function () {
                                        return this.get(currentAttr);
                                    };
                                }
                                if (!newClass.prototype['set' + field]) {
                                    newClass.prototype['set' + field] = function (data) {
                                        this.set(currentAttr, data);
                                        return this;
                                    }
                                }

                            });
                        }
                        return newClass;
                    }


                    /// Keep references & init Object class map
                    Parse.Object._classMap = {};

                    var origExtend = Parse.Object.extend;

                    /// Enhance Object 'extend' to store their subclass in a map
                    Parse.Object.extend = function (opts) {

                        var extended = origExtend.apply(this, arguments);

                        if (opts && opts.className) {
                            Parse.Object._classMap[opts.className] = extended;
                        }

                        return extended;

                    };


                    Parse.Object.getClass = function (className) {
                        return Parse.Object._classMap[className];
                    }


                    /// Enhance Object prototype
                    Parse.Object.prototype = angular.extend(Parse.Object.prototype, {
                        // Simple paginator
                        loadMore: function (opts) {

                            if (!angular.isUndefined(this.query)) {

                                // Default Parse limit is 100
                                var currentLimit = this.query._limit == -1 ? 100 : this.query._limit;
                                var currentSkip = this.query._skip;

                                currentSkip += currentLimit;

                                this.query.skip(currentSkip);

                                var _this = this;

                                return this.query.find()
                                    .then(function (newModels) {
                                        if (!opts || opts.add !== false) _this.add(newModels)
                                        if (newModels.length < currentLimit) _this.hasMoreToLoad = false;
                                        return newModels;
                                    });

                            }

                        }

                    });

                }

            }]);


    }

})(this);

angular.module('App', ['parse-angular', 'parse-angular.enhance'])
    .controller('Ctrl', ['$scope','$rootScope', function ($scope,$rootScope) {
        $scope.user = Parse.User.current();
        $scope.login = function () {
            if (!$scope.username || !$scope.password)
                return;
            Parse.User.logIn($scope.username, $scope.password, {
                success: function (user) {
                    location.reload();

                },
                error: function (user, error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }
        $scope.signup = function () {
            if (!$scope.username || !$scope.password)
                return;
            var user = new Parse.User();
            user.set("username", $scope.username);
            user.set("password", $scope.password);
            user.signUp(null, {
                success: function (user) {
                    location.reload();


                },
                error: function (user, error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }
        $scope.logout = function () {
            Parse.User.logOut().then(function () {
                location.reload();
            });
        }	

		$rootScope.isLoading = false;
        if (!$scope.user){
            return;
		}
        $scope.slideNum = 0;
        function retrieveLecture(lecId) {
            var Lectures = Parse.Object.extend("Lectures");

            var query = new Parse.Query(Lectures);
            query.equalTo("objectId", lecId);

            var subscription = query.subscribe();
            subscription.on('update', function (object) {
                $scope.slideNum = object.get("current");
                retrieveQuestions();

            });
            query.first({
                success: function (results) {
                    if (!results){
                        alert("Lecture Not Found");
                        return;
                    }
                    $scope.lecture = results;
                    $scope.lecName = results.get("name");
                    $scope.slideNum = results.get("current");
                    var relation = results.relation("students");
                    relation.add(Parse.User.current());

                    results.save().then(retrieveQuestions);
                },
                error: function (error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }

        function retrieveQuestions() {
            var Answers = Parse.Object.extend("Answers");
            var queryAnswers = new Parse.Query(Answers);
            queryAnswers.equalTo("lecture", $scope.lecture);
            queryAnswers.equalTo("user", Parse.User.current());

            var Questions = Parse.Object.extend("Questions");
            var query = new Parse.Query(Questions);
            query.equalTo("lecture", $scope.lecture);
            query.doesNotMatchKeyInQuery("objectId", "questionObjectId", queryAnswers);
            query.equalTo("slide", $scope.slideNum);

            query.find({
                success: function (results) {
                    $scope.questions = results;

                    $scope.answers = results.length ? shuffleArray(angular.copy(results[0].get('answers'))) : [];
                    if (Object.keys(results).length)
                        navigator.vibrate(500);
                },
                error: function (error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }


        $scope.AddAnswer = function (question, theAnswer) {
            var Answers = Parse.Object.extend("Answers");
            var answer = new Answers();

            answer.set("user", Parse.User.current());
            answer.set("question", question);
            if (theAnswer)
                answer.set("answer", theAnswer);
            answer.set("lecture", $scope.lecture);
            answer.set("questionObjectId", question.id);
            answer.set("slide", $scope.slideNum);

            answer.save(null, {
                success: function (answer) {
                    $('.removeActive').removeClass("active");
                    retrieveQuestions();
                },
                error: function (lecture, error) {
                    alert('Failed to create new object, with error code: ' + error.message);
                }
            });


        }

        $scope.scanLec = function () {
            if (document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1&& document.URL.indexOf('file://') === -1) {cordova.plugins.barcodeScanner.scan(
                    function (result) {
                        if (result.text != null && result.text != "") {
                            retrieveLecture(result.text);
                        }
                    },
                    function (error) {
                        alert("Scanning failed: " + error);
                    }
                );
            } else {
                          var lecId = prompt("Please enter lecture code", "");

                if (lecId != null && lecId != "") {
                    retrieveLecture(lecId);
                }
            }

        }
        function shuffleArray(array) {
            var m = array.length, t, i;

            // While there remain elements to shuffle
            while (m) {
                // Pick a remaining element…
                i = Math.floor(Math.random() * m--);

                // And swap it with the current element.
                t = array[m];
                array[m] = array[i];
                array[i] = t;
            }

            return array;
        }


    }]);