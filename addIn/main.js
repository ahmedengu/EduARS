Parse.initialize("myAppId");
Parse.serverURL = 'http://localhost:1337/parse';
Parse.clientKey = '';

angular.module('App', [])
    .controller('Ctrl', ['$scope', function ($scope) {
        $scope.user = Parse.User.current();
        $scope.login = function () {
            Parse.User.logIn($scope.username, $scope.password, {
                success: function (user) {
                    alert("Welcome back.");
                    location.reload();

                },
                error: function (user, error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }
        $scope.signup = function () {
            var user = new Parse.User();
            user.set("username", $scope.username);
            user.set("password", $scope.password);
            user.signUp(null, {
                success: function (user) {
                    alert("Welcome.");
                    location.reload();


                },
                error: function (user, error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }
        $scope.logout = function () {
            Parse.User.logOut().then(function () {
                alert("Bye.");
                location.reload();
            });
        }
        if (!$scope.user)
            return;
        $scope.slideNum = 0;
        $scope.answers = ["", ""];
        $scope.questions = [];
        $scope.theQuestion = "";
        $scope.lecName = "";
        $scope.slideCount = 0;
        function retrieveQuestions() {
            var Questions = Parse.Object.extend("Questions");
            var query = new Parse.Query(Questions);
            query.equalTo("lecture", $scope.lecture);
            query.equalTo("slide", $scope.slideNum);
            query.find({
                success: function (results) {
                    $scope.questions = results;
                    $scope.$apply();

                },
                error: function (error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }

        function createLecture() {
            var Lectures = Parse.Object.extend("Lectures");
            var lecture = new Lectures();

            lecture.set("name", "name");
            var base64 = "V29ya2luZyBhdCBQYXJzZSBpcyBncmVhdCE=";
            var file = new Parse.File("myfile.txt", {base64: base64});
            lecture.set("file", file);
            lecture.set("user", Parse.User.current());
            lecture.set("slideCount", $scope.slideCount);

            lecture.save(null, {
                success: function (lecture) {
                    $scope.lecture = lecture;
                    $scope.lecName = lecture.get("name");
                    localStorage.setItem("lectureId", lecture.id);
                    $scope.$apply();
                    retrieveQuestions();
                },
                error: function (lecture, error) {
                    alert('Failed to create new object, with error code: ' + error.message);
                }
            });
        }

        function retreiveLecture() {
            var Lectures = Parse.Object.extend("Lectures");

            var query = new Parse.Query(Lectures);
            query.get(localStorage.getItem("lectureId"), {
                success: function (results) {
                    $scope.lecture = results;
                    $scope.lecName = results.get("name");

                    $scope.$apply();
                    retrieveQuestions();
                },
                error: function (error) {
                    alert("Error: " + error.code + " " + error.message);
                }
            });
        }

        if (localStorage.getItem("lectureId")) {
            retreiveLecture();
        } else {
            createLecture();
        }
        $scope.addChoice = function () {
            $scope.answers.push("");
        }

        $scope.removeChoice = function (index) {
            $scope.answers.splice(index, 1);
        }
        $scope.AddQuestion = function () {
            var Questions = Parse.Object.extend("Questions");
            var question = new Questions();

            question.set("user", Parse.User.current());
            question.set("slide", $scope.slideNum);
            question.set("question", $scope.theQuestion);
            question.set("answers", $scope.answers);
            question.set("lecture", $scope.lecture);

            question.save(null, {
                success: function (question) {
                    $scope.questions.push(question);
                    $scope.answers = ["", ""];
                    $scope.answers[0] = "";
                    $scope.answers[1] = "";

                    $scope.theQuestion = "";

                    $scope.$apply();

                    retrieveQuestions();
                },
                error: function (lecture, error) {
                    alert('Failed to create new object, with error code: ' + error.message);
                }
            });


        }

        $scope.removeQuestion = function (index) {
            $scope.questions[index]
                .destroy({
                    success: function () {
                        $scope.questions.splice(index, 1);
                        $scope.$apply();
                        retrieveQuestions();
                    },
                    error: function (myObject, error) {
                        alert('Failed to destroy object, with error code: ' + error.message);
                    }
                });
        }

        $scope.updateLec = function () {
            var lecture = $scope.lecture;

            lecture.set("name", $scope.lecName);
            lecture.set("slideCount", $scope.slideCount);

            var base64 = "V29ya2luZyBhdCBQYXJzZSBpcyBncmVhdCE=";
            var file = new Parse.File("myfile.txt", {base64: base64});
            lecture.set("file", file);

            lecture.save(null, {
                success: function (lecture) {
                    $scope.lecture = lecture;
                    $scope.lecName = lecture.get("name");
                    localStorage.setItem("lectureId", lecture.id);
                    $scope.$apply();
                    retrieveQuestions();
                },
                error: function (lecture, error) {
                    alert('Failed to create new object, with error code: ' + error.message);
                }
            });

        }
        $scope.goToSlide = "";

        $scope.updateSlide = function () {
            var lecture = $scope.lecture;
            var slideGoTo = lecture.get("slideGoTo") || {};
            slideGoTo[$scope.slideNum] = $scope.goToSlide;
            lecture.set("slideGoTo", slideGoTo);

            lecture.save(null, {
                success: function (lecture) {
                    $scope.goToSlide = "";
                    $scope.$apply();
                },
                error: function (lecture, error) {
                    alert('Failed to create new object, with error code: ' + error.message);
                }
            });

        }
    }]);