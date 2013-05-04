require(['javascripts/thirdparty/jquery/jquery.js', 'javascripts/thirdparty/sammy/lib/sammy.js'], function(jQuery, sammy) {
    var login = function() {
            FB.login(function(response) {
                return response;
            }, {
                scope: 'email,user_likes,read_friendlists,read_insights,read_stream,friends_about_me,friends_activities,friends_birthday,friends_checkins,friends_education_history,friends_events,friends_games_activity,friends_groups,friends_hometown,friends_interests,friends_likes,friends_location,friends_notes,friends_online_presence,friends_relationship_details,friends_relationships,friends_religion_politics,friends_status,friends_subscriptions,friends_videos,friends_website,friends_work_history'
            });
        }

    var getMutualFriends = function(response) {
            $.ajax({
                url: '/fb/init',
                type: 'POST',
                data: {
                    access_token: response.authResponse.accessToken,
                    userid: response.authResponse.userID
                },
                success: function(dataR) {
                    console.log(dataR);
                }
            });
        }

    function postLogin() {
        FB.getLoginStatus(function(response) {
            if (response.status === 'connected') {
                $('.connection-status').html('Connected');

            } else if (response.status === 'not_authorized') {
                $('.connection-status').html('Not Authorized');
                response = login();
            } else {
                $('.connection-status').html('Please login first');
                response = login();
            }
        });
    }

    function pageInit($target) {
        // define a new Sammy.Application bound to the $target element selector
      Sammy($target.toString(), function() {

        // define a 'get' route that will be triggered at '#/path'
        this.get('#/', function() {
          // this context is a Sammy.EventContext
          this.$element() // $('#main')
              .html('A new route!');
        });
      }).run();
    }

});