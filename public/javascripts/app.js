requirejs(['javascripts/thirdparty/jquery/jquery.js', 'javascripts/thirdparty/sammy/lib/sammy.js', 'javascripts/thirdparty/moment/moment.js', 'socket.io/socket.io.js'], function(jQuery, Sammy, moment,  io) {
	//	internal app instance for exporting vars out of namespace
	var _app = Object;
	//	do facebook login
	window.login = function() {
		FB.login(function(response) {
			return response;
		}, {
			scope: 'email,user_likes,read_friendlists,read_insights,read_stream,friends_about_me,friends_activities,friends_birthday,friends_checkins,friends_education_history,friends_events,friends_games_activity,friends_groups,friends_hometown,friends_interests,friends_likes,friends_location,friends_notes,friends_online_presence,friends_relationship_details,friends_relationships,friends_religion_politics,friends_status,friends_subscriptions,friends_videos,friends_website,friends_work_history'
		});
	};
	//  postback to server with access_token to begin collection of friends lists
	window.getMutualFriends = function(response) {
		window.socket.emit('fb.friendsCollect', {
			access_token: response.authResponse.accessToken,
			userid: response.authResponse.userID
		});
	};
	//  executes 
	window.postLogin = function(callback) {
		var response;
		FB.getLoginStatus(function(response) {
			if (response.status === 'connected') {
				window.FBAuthorised = true;
				$('.connection-status')
					.html('Facebook Connected');
				window.socket.emit('fb.response', response);
				callback(response);
			} else if (response.status === 'not_authorized') {
				window.FBAuthorised = false;
				$('.connection-status')
					.html('App not authorized on Facebook');
				response = login();
				callback(response);
			} else {
				window.FBAuthorised = false;
				$('.connection-status')
					.html('Please login first');
				response = login();
				callback(response);
			}
		});
	};
	//  initialise routes, is executed once FB-SDK is loaded
	window.pageInit = function(jQuerytarget) {
		// define a new Sammy.Application bound to the jQuerytarget element selector
		var app = _app.app = Sammy(jQuerytarget.toString(), function() {
			this.get('/', function() {
				window.location = '#/login';
			});
			this.get('#/login', function() {
				this.log('facebook logged in');
				postLogin(function(response) {
					window.location = '#/home';
					window.userid = response.userid;
					getMutualFriends(response);
				});
			});
			//  main page
			this.get('#/home', function() {
				if (window.FBAuthorised) {
					this.log('Facebook Authorized');
					window.getMutualFriends();
				} else {
					this.log('Not Logged In');
					window.location = '#/login';
				}
			});
		});
		if (!window.FBAuthorised) {
			app.run('#/login');
		} else {
			app.run('#/home');
		}
		return app;
	};
	//  async init
	//  acts as a wrapper for main init
	window.fbAsyncInit = function() {
		// init the FB JS SDK
		FB.init({
			appId: '332579633512130',
			status: true,
			cookie: true,
			xfbml: true
		});
		window.$app = window.pageInit('#main');
		//	init websocket connection
		window.socket = io.connect('http://' + window.location.host);
		//  connection to websocket is established
		window.socket.on('connect', function() {
			window.socketConnectionStatus = 'connected';
			$('.socket-connection-status')
				.html('Websocket Connected');
		});
		//	Facebook events
		window.socket.on('fb.friendsCollect.start', function(job) {
			console.log(job);
			$('.log').append('<div>Job added to work queue, jobID: '+ job.data.jobID);
			$('.log')
				.append('<span class="percentDone">0%</span> Complete');
		});
		window.socket.on('fb.friendsCollect.progress', function(jobProgress) {
			$('.percentDone').html(jobProgress.progress + '%');
		});
		window.socket.on('fb.friendsCollect.complete', function(job) {
			var timeTaken = job.time.ended - job.time.started;
			$('.log').append('<div>Job completed, timetaken: '+timeTaken+'</div>' + JSON.stringify(job));
			$('.log').append('<div>Getting friends</div>');
			$.ajax({url:'/api/'+job.data.userID+'/getFriends', type:'get', async:false, cache:false, success:function(friends){
				console.log(friends);
			}});
		});
	};
	// Load the FB SDK asynchronously
	(function(d, s, id) {
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