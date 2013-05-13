require.config({
	paths: {
		'jquery': 'javascripts/thirdparty/jquery/jquery',
		'mustache': 'javascripts/thirdparty/mustache/mustache',
		'moment': 'javascripts/thirdparty/moment/moment',
		'sammy': 'javascripts/thirdparty/sammy/lib/sammy',
		'sammy.mustache': 'javascripts/thirdparty/sammy/lib/plugins/sammy.mustache',
		'io': 'socket.io/socket.io',
		'QDG': 'javascripts/QuarkDG',
		'Q_DirectedGraph': 'javascripts/Q_DirectedGraph'
	},
	shim: {
		'sammy': {
			deps: ['jquery'],
			exports: 'Sammy'
		},
		'sammy.mustache': {
			deps: ['jquery', 'sammy', 'mustache'],
			exports: 'Sammy.Mustache'
		},
		'Q_DirectedGraph': {
			deps: ['jquery'],
			exports: 'Q_DirectedGraph'
		},
		'QDG': {
			deps: ['jquery', 'Q_DirectedGraph'],
			exports: 'QDG'
		}
	}
});
define(['jquery', 'moment', 'io', 'mustache', 'sammy', 'Q_DirectedGraph', 'QDG', 'sammy.mustache'], function($, Moment, io, Mustache, Sammy, Quark) {
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
				window.me = response.authResponse.userID;
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
		// requirejs(['javascripts/thirdparty/sammy/lib/plugins/sammy.mustache.js'], function (sammyMustache) {
		// define a new Sammy.Application bound to the jQuerytarget element selector
		window.app = Sammy(jQuerytarget.toString(), function() {
			//	configure
			this.debug = true;
			this.use(Sammy.Mustache);
			this.notFound = function(verb, path) {
				this.runRoute('get', '#/404');
			};
			//	not found
			this.get('#/404', function() {});
			//	do login
			this.get('#/login', function() {
				var response = window.login();
				var context = this;
				postLogin(function(response) {
					context.log('facebook logged in');
					context.log(response);
					window.fbResponse = response;
					context.redirect('#/home');
				});
			});
			//  main page
			this.get('#/home', function() {
				var context = this;
				if (window.FBAuthorised) {
					context.log('Facebook Authorized');
					getMutualFriends(window.fbResponse);
				} else {
					context.log('Not Logged In');
					context.redirect('#/login');
				}
			});
			//	get friends of user
			this.get('#/:userid/friends', function() {
				var context = this;
				var meID = context.me = this.params['userid'];
				window.me = meID;
				this.load('/api/' + meID + '/friends', {
					type: 'get',
					dataType: 'json'
				})
					.then(function(data) {
					context.friends = data;
					context.load('/partials/friends.mu.html', {
						friends: data
					})
						.then(function(html) {
						var render = Mustache.to_html(html, {
							friends: context.friends
						}, null);
						context.$element()
							.html(render);
					});
				});
			});
			//	get friends in common with friendid
			this.get('#/:friendID/incommon', function() {
				var context = this;
				var friendID = context.params['friendID'];
				this.load('/api/' + window.me + '/mutualfriends/' + friendID, {
					type: 'get',
					dataType: 'json'
				})
					.then(function(data) {
					//	store mutual friends in context
					context.mutualfriends = context.mutualfriends || {};
					context.mutualfriends[friendID] = data;
					//	load partial
					context.load('/partials/mutualfriends.mu.html')
						.then(function(template) {
						var render = Mustache.to_html(template, {
							friends: data
						}, null);
						$('.mutual-friends-list')
							.slideUp("fast")
							.remove();
						$('a[data-friendID="' + friendID + '"]')
							.parents('dt')
							.next()
							.html(render);
						$('.mutual-friends-list')
							.slideDown("fast");
					});
				});
			});
			this.get('#/:me/graph', function() {
				window.setTimeout(function() {
					FB.getLoginStatus(function(response) {
						if (response.status === 'connected') {
							$('#loginArea').hide();
							$('.connection-status').text('Facebook Authorized');
							$('#visualization').height($(window).height() - ($('.topbar').height() + 20));
							main(FB);
						} else {
							$('#loginArea').show();
							$('.connection-status').text('Facebook Not Connected');
						}
					});
				}, 0);
			});
		}).run();
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
		window.pageInit('#main');
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
			$('.log')
				.append('<div>Job added to work queue, jobID: ' + job.data.jobID);
			$('.log')
				.append('<span class="percentDone">0%</span> Complete');
		});
		window.socket.on('fb.friendsCollect.progress', function(jobProgress) {
			$('.percentDone')
				.html(jobProgress.progress + '%');
		});
		window.socket.on('fb.friendsCollect.complete', function(job) {
			var timeTaken = moment(job.time.started)
				.fromNow();
			$('.log')
				.append('<div>Job completed, job started: ' + timeTaken + '</div>');
			window.location = '#/' + job.job.data.userid + '/friends';
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
