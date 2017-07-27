/// <reference path="/Scripts/FabricUI/MessageBanner.js" />
Parse.initialize("lIPQqClBkGvd78SS5OBG2Tc8H9mKNjRKYo8oqe1u", "CnzMmHCl8YVAR2v1RypHudGbB9mrKz9R42d7TWMS");
Parse.serverURL = 'https://powerp.back4app.io/';
// piw23106@tqosi.com
(function(window, undef) {

    var angular = window.angular;

    if (angular !== undef) {

        var module = angular.module('parse-angular', []);

        module.run([
            '$q', '$window', '$rootScope', function($q, $window, $rootScope) {
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

                        var rejectHandler = function(obj, err) {
                            var defer = $q.defer();
                            obj.code = obj.code || (err && err.code) || 100;
                            obj.message = obj.message || (err && err.message);
                            console.log(obj);
                            defer.reject(obj);
                            return defer.promise;
                        };

//                    /// Patching prototypes
                        currentProtoMethods.forEach(function(method) {

                            var origMethod = Parse[currentClass].prototype[method];

                            // Overwrite original function by wrapping it with $q
                            Parse[currentClass].prototype[method] = function() {
                                $rootScope.isLoading = true;
                                return origMethod.apply(this, arguments)
                                    .then(function(data) {
                                            var defer = $q.defer();
                                            defer.resolve(data);
                                            $rootScope.isLoading = false;
                                            $rootScope.loadingProgress = false;
                                            return defer.promise;
                                        },
                                        function(obj, err) {
                                            $rootScope.isLoading = false;
                                            $rootScope.loadingProgress = false;
                                            return rejectHandler(obj, err);
                                        });
                            };

                        });


                        //Patching static methods too
                        currentStaticMethods.forEach(function(method) {

                            var origMethod = Parse[currentClass][method];

                            // Overwrite original function by wrapping it with $q
                            Parse[currentClass][method] = function() {
                                $rootScope.isLoading = true;
                                return origMethod.apply(this, arguments)
                                    .then(function(data) {
                                            var defer = $q.defer();
                                            defer.resolve(data);
                                            $rootScope.isLoading = false;
                                            $rootScope.loadingProgress = false;
                                            return defer.promise;
                                        },
                                        function(obj, err) {
                                            $rootScope.isLoading = false;
                                            $rootScope.loadingProgress = false;
                                            return rejectHandler(obj, err);
                                        });
                            };

                        });


                    }
                }

            }
        ]);


        angular.module('parse-angular.enhance', ['parse-angular'])
            .run([
                '$q', '$window', function($q, $window) {


                    if (Parse) {


                        /// Create a method to easily access our object
                        /// Because Parse.Object("xxxx") is actually creating an object and we can't access static methods

                        Parse.Object.getClass = function(className) {
                            return Parse.Object._classMap[className];
                        };

                        ///// CamelCaseIsh Helper
                        function capitaliseFirstLetter(string) {
                            return string.charAt(0).toUpperCase() + string.slice(1);
                        }


                        ///// Override orig extend
                        var origObjectExtend = Parse.Object.extend;

                        Parse.Object.extend = function(protoProps) {

                            var newClass = origObjectExtend.apply(this, arguments);

                            if (Parse._ && Parse._.isObject(protoProps) && Parse._.isArray(protoProps.attrs)) {
                                var attrs = protoProps.attrs;
                                /// Generate setters & getters
                                Parse._.each(attrs,
                                    function(currentAttr) {

                                        var field = capitaliseFirstLetter(currentAttr);

                                        // Don't override if we set a custom setters or getters
                                        if (!newClass.prototype['get' + field]) {
                                            newClass.prototype['get' + field] = function() {
                                                return this.get(currentAttr);
                                            };
                                        }
                                        if (!newClass.prototype['set' + field]) {
                                            newClass.prototype['set' + field] = function(data) {
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
                        Parse.Object.extend = function(opts) {

                            var extended = origExtend.apply(this, arguments);

                            if (opts && opts.className) {
                                Parse.Object._classMap[opts.className] = extended;
                            }

                            return extended;

                        };


                        Parse.Object.getClass = function(className) {
                            return Parse.Object._classMap[className];
                        }


                        /// Enhance Object prototype
                        Parse.Object.prototype = angular.extend(Parse.Object.prototype,
                            {
                                // Simple paginator
                                loadMore: function(opts) {

                                    if (!angular.isUndefined(this.query)) {

                                        // Default Parse limit is 100
                                        var currentLimit = this.query._limit == -1 ? 100 : this.query._limit;
                                        var currentSkip = this.query._skip;

                                        currentSkip += currentLimit;

                                        this.query.skip(currentSkip);

                                        var _this = this;

                                        return this.query.find()
                                            .then(function(newModels) {
                                                if (!opts || opts.add !== false) _this.add(newModels)
                                                if (newModels.length < currentLimit) _this.hasMoreToLoad = false;
                                                return newModels;
                                            });

                                    }

                                }

                            });

                    }

                }
            ]);


    }

})(this);

angular.module('App', ['parse-angular', 'parse-angular.enhance'])
    .controller('Ctrl',
        [
            '$scope', '$rootScope', function($scope, $rootScope) {
                $scope.user = Parse.User.current();
                $scope.login = function() {
                    if (!$scope.username || !$scope.password)
                        return;
                    Parse.User.logIn($scope.username,
                        $scope.password,
                        {
                            success: function(user) {
                                showNotification("Alert", "Welcome back.");
                                location.reload();

                            },
                            error: function(user, error) {
                                showNotification("Alert", "Error: " + error.code + " " + error.message);
                            }
                        });
                }
                $scope.logout = function() {
                    Parse.User.logOut().then(function() {
                        showNotification("Alert", "Bye.");
                        location.reload();
                    });
                }

                $rootScope.isLoading = false;

                if (!$scope.user) {
                    return;
                }

                $scope.slideNum = 0;
                $scope.lecName = "";
           if(Office.context)
                        Office.context.document.getSelectedDataAsync(Office.CoercionType.SlideRange,
                            function(asyncResult) {
                                if (asyncResult.status != "failed" &&
                                    $scope.slideNum != asyncResult.value.slides[0].index) {
                                    $scope.slideNum = asyncResult.value.slides[0].index;
                                    $scope.$apply();
                                }
                            });

                function retrieveQuestions() {
                    var Questions = Parse.Object.extend("Questions");
                    var query = new Parse.Query(Questions);
                    query.equalTo("lecture", $scope.lecture);
                    query.equalTo("slide", $scope.slideNum);
                    query.find({
                        success: function(results) {
                            $scope.questions = results;
                        },
                        error: function(error) {
                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                        }
                    });
                }
                $scope.whoScaned = function () {
                    getStudents();
                    var currentSlide = $scope.slideNum;
                    Office.context.document.settings.set("whoScaned", true);
                    persistSettings();

                    setInterval(function () {
                        getStudents(currentSlide);
                    }, 3000)
                }



                function initQA(question) {
                    $scope.theQuestion = question;

                    $scope.answers = shuffleArray(question.get('answers'));
                    var query = $scope.lecture.get('students').query();
                    query.descending("createdAt");
                    query.find({
                        success: function (results) {
                            $scope.students = results;
                        },
                        error: function (error) {
                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                        }
                    });

                    qAnswers(question);
                function countDown(i, callback) {
                    callback = callback || function () { };
                  var  anInterval = setInterval(function () {
                        document.getElementById("myDIV").innerHTML = i + " Seconds";
                        i-- || (clearInterval (anInterval), callback());
                        }, 1000);
                    }

                countDown($scope.timer, function () {
                    $scope.showAnswers=[];
                    for (i in $scope.QuestionAnswers) {
                        if (!$scope.QuestionAnswers[i].get('answer')) {
                            if (!$scope.showAnswers[$scope.answers.length]) {
                                $scope.showAnswers[$scope.answers.length] = 1;
                            } else {
                                $scope.showAnswers[$scope.answers.length]++;
                            }
                        } else {
                            for (j in $scope.answers) {
                                if ($scope.answers[j] == $scope.QuestionAnswers[i].get('answer')) {
                                    if (!$scope.showAnswers[j]) {
                                        $scope.showAnswers[j] = 1;
                                    } else {
                                        $scope.showAnswers[j]++;
                                    }
                                }
                            }
                        }
                    }
                    $scope.$apply();
                    });

                }
                  
                

                $scope.setQuestion = function (question) {
                    if (!$scope.timer)
                        return;
                    Office.context.document.settings.set("theQuestion", question.id);
                    Office.context.document.settings.set("timer", $scope.timer);
                    persistSettings();

                    initQA(question);
                }

                function retreiveLecture() {
                    var Lectures = Parse.Object.extend("Lectures");

                    var query = new Parse.Query(Lectures);
                    query.equalTo("objectId", Office.context.document.settings.get("lectureId"));
                    query.first({
                        success: function(results) {
                            if (Object.keys(results).length) {
                                $scope.lecture = results;
                                $scope.lecName = results.get("name");
                                $scope.successRate = results.get("successRate");
                                if (Office.context.document.settings.get("whoScaned")) {
                                    $scope.whoScaned();
                                } else if (Office.context.document.settings.get("theQuestion")) {
                                    var Questions = Parse.Object.extend("Questions");
                                    var query = new Parse.Query(Questions);
                                    query.get(Office.context.document.settings.get("theQuestion"),{
                                        success: function (results) {
                                            $scope.theQuestion = results;
                                            $scope.timer = Office.context.document.settings.get("timer");
                                            $scope.setQuestion(results);
                                        },
                                        error: function (error) {
                                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                                        }
                                    });
                                } else {
                                    retrieveQuestions();
                                }
                            } 
                        },
                        error: function(error) {
                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                        }
                    });

                }


                function qAnswers(question) {
                    var Answers = Parse.Object.extend("Answers");
                    var query = new Parse.Query(Answers);
                    query.equalTo("question",question);
                    query.include('user');
                    var subscription = query.subscribe();

                    subscription.on('create', function (object) {
                        $scope.QuestionAnswers.push(object);
                        for (i in $scope.students) {
                            if (object.get('user').id == $scope.students[i].id) {
                                $scope.students.splice(i, 1);
                            }
                        }
                    });

                    query.find({
                        success: function(results) {
                            $scope.QuestionAnswers = results;
                        },
                        error: function(error) {
                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                        }
                    });
                }

                function getStudents(currentSlide) {
                    if (currentSlide&&currentSlide != $scope.slideNum)
                        return;
                    var query = $scope.lecture.get('students').query();
                    query.descending("createdAt");
                    query.find({
                        success: function (results) {
                            $scope.students = results;
                        },
                        error: function (error) {
                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                        }
                    });
                }



                $scope.downloadAnswers = function() {
                    var query = new Parse.Query("Answers");
                    query.equalTo('lecture', $scope.lecture);
                    query.include('question');
                    query.include('user');
                    query.ascending("user");
                    query.exists("user");

                    query.find({
                        success: function(results) {
                            var out = [];
                            for (i in results) {
                                if (!_.last(out) || results[i].get('user').get('username') != _.last(out).username) {
                                    var object = { username: results[i].get('user').get('username') };
                                    out.push(object);
                                }
                                _.last(out)[results[i].get('question').get('question')] = results[i].get('answer');
                            }
                            download(Papa.unparse(out), "studentsAnswers.csv", "text/csv");
                        },
                        error: function(error) {
                            showNotification("Alert", "Error: " + error.code + " " + error.message);
                        }
                    });
                }

                $scope.getLec = function () {
                    if (!$scope.lecCode)
                        return;
                    Office.context.document.settings.set("lectureId", $scope.lecCode);
                    persistSettings();
                    retreiveLecture();
                }
                if (Office.context&&Office.context.document.settings.get("lectureId") &&
                    Office.context.document.settings.get("lectureId").length) {
                    retreiveLecture();
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
            }
        ]);


var messageBanner;

// The initialize function must be run each time a new page is loaded.
Office.initialize = function(reason) {

    $(document).ready(function() {
        var element = document.querySelector('.ms-MessageBanner');
        messageBanner = new fabric.MessageBanner(element);
        messageBanner.hideBanner();
        $('#get-data-from-selection').click(getDataFromSelection);

    });
};
$(document).ready(function () {
    try {
        if (!Office.context.document) {
            var $scope = angular.element($('html')).scope();
            $scope.isLoading = true;
            $scope.$apply();

            $('#divLoading').append('<h1 class="text-center">This is a PowerPoint Addin</h1>');
            $('.removeMe').remove();

        }
    } catch (e) {
        var $scope = angular.element($('html')).scope();
        $scope.isLoading = true;
        $scope.$apply();
        $('#divLoading').append('<h1 class="text-center">This is a PowerPoint Addin</h1>');
        $('.removeMe').remove();

    }
});

// Reads data from current document selection and displays a notification
function getDataFromSelection() {
    Office.context.document.getSelectedDataAsync(Office.CoercionType.Text,
        function(result) {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
                showNotification('The selected text is:', '"' + result.value + '"');
            } else {
                showNotification('Error:', result.error.message);
            }
        }
    );
}

// Helper function for displaying notifications
function showNotification(header, content) {
    $("#notification-header").text(header);
    $("#notification-body").text(content);
    if (typeof messageBanner != "undefined") {
        messageBanner.showBanner();
        messageBanner.toggleExpansion();
    }

    console.log(header + ": " + content);
}

function getActiveFileView() {
    Office.context.document.getActiveViewAsync(function(asyncResult) {
        if (asyncResult.status == "failed") {
            showNotification("Action failed with error: " + asyncResult.error.message);
        } else {
            showNotification(asyncResult.value);
        }
    });

}


function registerActiveViewChanged() {
    activeViewHandler = function(args) {
        showNotification(JSON.stringify(args));
    }

    Office.context.document.addHandlerAsync(Office.EventType.ActiveViewChanged,
        activeViewHandler,
        function(asyncResult) {
            if (asyncResult.status == "failed") {
                showNotification("Action failed with error: " + asyncResult.error.message);
            } else {
                showNotification(asyncResult.status);
            }
        });
}

firstSlideId = 0;

function getSelectedRange() {
    // Get the id, title, and index of the current slide (or selected slides) and store the first slide id */

    Office.context.document.getSelectedDataAsync(Office.CoercionType.SlideRange,
        function(asyncResult) {
            if (asyncResult.status == "failed") {
                showNotification("Action failed with error: " + asyncResult.error.message);
            } else {
                firstSlideId = asyncResult.value.slides[0].id;
                showNotification(JSON.stringify(asyncResult.value));
            }
        });
}

function goToFirstSlide() {
    Office.context.document.goToByIdAsync(firstSlideId,
        Office.GoToType.Slide,
        function(asyncResult) {
            if (asyncResult.status == "failed") {
                showNotification("Action failed with error: " + asyncResult.error.message);
            } else {
                showNotification("Navigation successful");
            }
        });
}

function goToSlideByIndex() {
    var goToFirst = Office.Index.First;
    var goToLast = Office.Index.Last;
    var goToPrevious = Office.Index.Previous;
    var goToNext = Office.Index.Next;

    Office.context.document.goToByIdAsync(goToNext,
        Office.GoToType.Index,
        function(asyncResult) {
            if (asyncResult.status == "failed") {
                showNotification("Action failed with error: " + asyncResult.error.message);
            } else {
                showNotification("Navigation successful");
            }
        });
}

function getFileUrl() {
    //Get the URL of the current file.
    Office.context.document.getFilePropertiesAsync(function(asyncResult) {
        var fileUrl = asyncResult.value.url;
        if (fileUrl == "") {
            showNotification("The file hasn't been saved yet. Save the file and try again");
        } else {
            showNotification(fileUrl);
        }
    });
}


function persistSettings() {
    Office.context.document.settings.saveAsync(function(asyncResult) {
        if (asyncResult.status == Office.AsyncResultStatus.Failed) {
            showNotification('Settings save failed. Error: ' + asyncResult.error.message);
        }
    });
}

function insertImage(value) {
    insertPictureAtSelection(getImageAsBase64(value));
}

function insertPictureAtSelection(base64EncodedImageStr) {
    Office.context.document.setSelectedDataAsync(base64EncodedImageStr,
        {
            coercionType: Office.CoercionType.Image,
            imageLeft: 50,
            imageTop: 50,
            imageWidth: 100,
            imageHeight: 100
        },
        function(asyncResult) {
            if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                console.log("Action failed with error: " + asyncResult.error.message);
            }
        });
}

function insertText(value) {
    Office.context.document.setSelectedDataAsync(value,
        {
            coercionType: Office.CoercionType.Text
        },
        function(asyncResult) {
            if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                console.log("Action failed with error: " + asyncResult.error.message);
            }
        });
}

function getImageAsBase64(value) {

    var qr = new QRious({
        value: value
    });
    return qr.toDataURL().replace("data:image/png;base64,", "");
}