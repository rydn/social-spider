(function () {
	require(['javascripts/thirdparty/jquery/jquery.js', 'javascripts/thirdparty/sammy/lib/sammy.js', 'socket.io/socket.io.js'], function (jQuery, Sammy, io) {
		//	internal app instance for exporting vars out of namespace
		var _app =  Object;
		//	do facebook login
		var login = function () {
			FB.login(function (response) {
				return response;
			}, {
				scope: 'email,user_likes,read_friendlists,read_insights,read_stream,friends_about_me,friends_activities,friends_birthday,friends_checkins,friends_education_history,friends_events,friends_games_activity,friends_groups,friends_hometown,friends_interests,friends_likes,friends_location,friends_notes,friends_online_presence,friends_relationship_details,friends_relationships,friends_religion_politics,friends_status,friends_subscriptions,friends_videos,friends_website,friends_work_history'
			});
		};
		//  postback to server with access_token to begin collection of friends lists
		var getMutualFriends = function (response) {
			$.ajax({
				url: '/fb/init',
				type: 'POST',
				data: {
					access_token: response.authResponse.accessToken,
					userid: response.authResponse.userID
				},
				success: function (dataR) {
					console.log(dataR);
				}
			});
		};
		//  executes 

		function postLogin() {
			FB.getLoginStatus(function (response) {
				if (response.status === 'connected') {
					window.FBAuthorised = true;
					$('.connection-status')
						.html('Connected');
				} else if (response.status === 'not_authorized') {
					$('.connection-status')
						.html('App not authorized');
					response = login();
				} else {
					$('.connection-status')
						.html('Please login first');
					response = login();
				}
			});
		}
		//  initialise routes, is executed once FB-SDK is loaded
		var pageInit = function (jQuerytarget) {
			//	init websocket connection
			_app.socket = io.connect('http://' + window.location.host);
			// define a new Sammy.Application bound to the jQuerytarget element selector
			var app = _app.app = Sammy(jQuerytarget.toString(), function () {
				this.get('#/login', function () {
					postLogin();
					window.location = '#/home';
				});
				//  main page
				this.get('#/home', function (context) {
					if (window.FBAuthorised) {
						//  connection to websocket is established
						_app.socket.on('connect', function () {
							context.element('#main')
								.append('websocket connect');
							context.load('/models/index')
								.then(function (item) {
								this.log(item);
								return item[0];
							});
						});
					} else {
						this.log('Not Logged In');
						window.location = '#/login';
					}
				});
			});
			if (!window.FBAuthorised) {
				app.run('#/login');
			}
			return app;
		};
		//  async init
		//  acts as a wrapper for main init
		window.fbAsyncInit = function () {
			// init the FB JS SDK
			FB.init({
				appId: '332579633512130',
				status: true,
				cookie: true,
				xfbml: true
			});
			window.$app = pageInit('#main');
		};
		// Load the FB SDK asynchronously
		(function (d, s, id) {
			var js, fjs = d.getElementsByTagName(s)[0];
			if (d.getElementById(id)) {
				return;
			}
			js = d.createElement(s);
			js.id = id;
			js.src = "//connect.facebook.net/en_US/all.js";
			fjs.parentNode.insertBefore(js, fjs);
		}(document, 'script', 'facebook-jssdk'));
		return _app;
	});
})();