require.config({
	paths: {
		'jquery': 'javascripts/thirdparty/jquery/jquery',
		'mustache': 'javascripts/thirdparty/mustache/mustache',
		'moment': 'javascripts/thirdparty/moment/moment',
		'sammy': 'javascripts/thirdparty/sammy/lib/sammy',
		'sammy.mustache': 'javascripts/thirdparty/sammy/lib/plugins/sammy.mustache',
		'd3': 'javascripts/thirdparty/d3/d3',
		'io': 'socket.io/socket.io'
	},
	shim: {
		'sammy': {
			deps: ['jquery'],
			exports: 'Sammy'
		},
		'sammy.mustache': {
			deps: ['jquery', 'sammy', 'mustache'],
			exports: 'Sammy.Mustache'
		}
	}
});
define(['jquery', 'moment', 'io', 'mustache', 'd3', 'sammy', 'sammy.mustache'], function($, Moment, io, Mustache, _d3, Sammy) {
	console.log(_d3);
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
			//	render force directed graph with d3
			this.get('#/:me/graph', function() {
				var $this = this;
				this.$element().html('<div id="#chart"></div>');
				$.getJSON('/api/' + this.params['me'] + '/graphdata', function(graphdata) {
					var nodeSet = graphdata.nodes;
					var linkSet = graphdata.links;
					var focalNodeID = $this.params['me'];
					console.log(nodeSet, linkSet, focalNodeID);
					var width = 960,
						height = 700,
						centerNodeSize = 50;
					nodeSize = 10;
					colorScale = d3.scale.category20();
					var svgCanvas = d3.select("#chart").append("svg:svg")
						.attr("width", width)
						.attr("height", height);
					var node_hash = {};
					var type_hash = {};
					// Create a hash that allows access to each node by its id
					nodeSet.forEach(function(d, i) {
						node_hash[d.id] = d;
						type_hash[d.type] = d.type;
					});
					console.log(node_hash);
					// Append the source object node and the target object node to each link
					linkSet.forEach(function(d, i) {
						if (d) {
							
							if (d.sourceId == focalNodeID) {
								d.direction = "OUT";
							} else {
								d.direction = "IN";
							}
						}
					});
					// Create a force layout and bind Nodes and Links
					var force = d3.layout.force()
						.charge(-1000)
						.nodes(nodeSet)
						.links(linkSet)
						.size([width, height])
						.linkDistance(function(d) {
						if (width < height) {
							return width * 1 / 3;
						} else {
							return height * 1 / 3;
						}
					}) // Controls edge length
					.on("tick", tick)
						.start();
					// Draw lines for Links between Nodes
					var link = svgCanvas.selectAll(".gLink")
						.data(force.links())
						.enter().append("g")
						.attr("class", "gLink")
						.append("line")
						.attr("class", "link")
						.style("stroke", "#ccc")
						.attr("x1", function(d) {
						return d.source.x;
					})
						.attr("y1", function(d) {
						return d.source.y;
					})
						.attr("x2", function(d) {
						return d.target.x;
					})
						.attr("y2", function(d) {
						return d.target.y;
					});
					// Create Nodes
					var node = svgCanvas.selectAll(".node")
						.data(force.nodes())
						.enter().append("g")
						.attr("class", "node")
						.on("mouseover", nodeMouseover)
						.on("mouseout", nodeMouseout)
						.call(force.drag);
					// Append circles to Nodes
					node.append("circle")
						.attr("x", function(d) {
						return d.x;
					})
						.attr("y", function(d) {
						return d.y;
					})
						.attr("r", function(d) {
						if (d.id == focalNodeID) {
							return centerNodeSize;
						} else {
							return nodeSize;
						}
					}) // Node radius
					.style("fill", "White") // Make the nodes hollow looking
					.style("stroke-width", 5) // Give the node strokes some thickness
					.style("stroke", function(d, i) {
						colorVal = colorScale(i);
						return colorVal;
					}) // Node stroke colors
					.call(force.drag);
					// Append text to Nodes
					node.append("a")
						.attr("xlink:href", function(d) {
						return d.hlink;
					})
						.append("text")
						.attr("x", function(d) {
						if (d.id == focalNodeID) {
							return 0;
						} else {
							return 20;
						}
					})
						.attr("y", function(d) {
						if (d.id == focalNodeID) {
							return 0;
						} else {
							return -10;
						}
					})
						.attr("text-anchor", function(d) {
						if (d.id == focalNodeID) {
							return "middle";
						} else {
							return "start";
						}
					})
						.attr("font-family", "Arial, Helvetica, sans-serif")
						.style("font", "normal 16px Arial")
						.attr("fill", "Blue")
						.attr("dy", ".35em")
						.text(function(d) {
						return d.name;
					});
					// Append text to Link edges
					var linkText = svgCanvas.selectAll(".gLink")
						.data(force.links())
						.append("text")
						.attr("font-family", "Arial, Helvetica, sans-serif")
						.attr("x", function(d) {
						if (d.target.x > d.source.x) {
							return (d.source.x + (d.target.x - d.source.x) / 2);
						} else {
							return (d.target.x + (d.source.x - d.target.x) / 2);
						}
					})
						.attr("y", function(d) {
						if (d.target.y > d.source.y) {
							return (d.source.y + (d.target.y - d.source.y) / 2);
						} else {
							return (d.target.y + (d.source.y - d.target.y) / 2);
						}
					})
						.attr("fill", "Maroon")
						.style("font", "normal 12px Arial")
						.attr("dy", ".35em")
						.text(function(d) {
						return d.linkName;
					});

					function tick() {
						link.attr("x1", function(d) {
							return d.source.x;
						})
							.attr("y1", function(d) {
							return d.source.y;
						})
							.attr("x2", function(d) {
							return d.target.x;
						})
							.attr("y2", function(d) {
							return d.target.y;
						});
						node.attr("transform", function(d) {
							return "translate(" + d.x + "," + d.y + ")";
						});
						linkText.attr("x", function(d) {
							if (d.target.x > d.source.x) {
								return (d.source.x + (d.target.x - d.source.x) / 2);
							} else {
								return (d.target.x + (d.source.x - d.target.x) / 2);
							}
						})
							.attr("y", function(d) {
							if (d.target.y > d.source.y) {
								return (d.source.y + (d.target.y - d.source.y) / 2);
							} else {
								return (d.target.y + (d.source.y - d.target.y) / 2);
							}
						});
					}

					function nodeMouseover() {
						d3.select(this).select("circle").transition()
							.duration(250)
							.attr("r", function(d, i) {
							if (d.id == focalNodeID) {
								return 65;
							} else {
								return 15;
							}
						});
						d3.select(this).select("text").transition()
							.duration(250)
							.style("font", "bold 20px Arial")
							.attr("fill", "Blue");
					}

					function nodeMouseout() {
						d3.select(this).select("circle").transition()
							.duration(250)
							.attr("r", function(d, i) {
							if (d.id == focalNodeID) {
								return centerNodeSize;
							} else {
								return nodeSize;
							}
						});
						d3.select(this).select("text").transition()
							.duration(250)
							.style("font", "normal 16px Arial")
							.attr("fill", "Blue");
					}
				});
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