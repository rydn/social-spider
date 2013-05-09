var QuarkDG = QuarkDG || {}; /*internal QuarkDG window*/
QuarkDG.utils = function() {
	var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return {
		formatDate: function(d, includeTime) {
			if (d) {
				var date = new Date(d);
				var formattedDate = '';
				if (includeTime) {
					formattedDate += date.getHours() + ':' + date.getMinutes() + ' ';
				}
				formattedDate += months[date.getMonth()];
				formattedDate += ' ' + date.getDate() + ', ';
				formattedDate += date.getFullYear();
				return formattedDate;
			}
		},
		formatNumber: function(str) {
			str += '';
			var x = str.split('.'),
				x1 = x[0],
				x2 = x.length > 1 ? '.' + x[1] : '',
				rgx = /(\d+)(\d{3})/;
			while (rgx.test(x1)) {
				x1 = x1.replace(rgx, '$1' + ',' + '$2');
			}
			return x1 + x2;
		},
		getQueryStringValue: function(keyName) {
			var pattern = new RegExp(keyName + '=' + '([^&#]*)'),
				match = window.location.hash.match(pattern);
			if (match) {
				return window.unescape(match[1]);
			}
		}
	};
};
/*global QuarkDG*/
QuarkDG.progressToken = function() {
	var canceled = false,
		progressComplete = false,
		notificationCallback;
	return {
		/**
		 * Cancels this progress.
		 */
		cancel: function() {
			canceled = true;
		},
		/**
		 * Sets the update callback or triggers the update callback if
		 * callbackOrUpdate argument is not a function.
		 */
		update: function(callbackOrUpdate) {
			if (typeof callbackOrUpdate === 'function') {
				notificationCallback = callbackOrUpdate;
				return this;
			}
			if (notificationCallback) {
				notificationCallback(callbackOrUpdate);
				return this;
			}
		},
		complete: function(message) {
			progressComplete = true;
			this.update(message);
		},
		isCanceled: function() {
			return canceled;
		},
		isCompleted: function() {
			return progressComplete;
		},
		reset: function() {
			canceled = progressComplete = false;
		}
	};
};
/*global $ QuarkDG window*/
QuarkDG.restClient = function() {
	return {
		get: function(address, callback) {
			$.get(address, callback);
		},
		getJSON: function(address, callback) {
			$.getJSON(address, callback).error(function() {
				window.alert('Failed to get json');
			});
		},
		put: function(address, data, callback) {
			// TODO: what if JSON is not supported?
			$.post(address, {
				data: JSON.stringify(data)
			}, callback, 'json');
		},
		getJSONPE: function(address, callback, error) {
			$.jsonp({
				url: address,
				dataType: "jsonp",
				timeout: 15000,
				success: function(data, status) {
					callback(data, status);
				},
				error: function(XHR, textStatus, errorThrown) {
					if (typeof error === 'function') {
						error();
					}
				}
			});
		}
	};
}; /*global QuarkDG*/
QuarkDG.importanceBuilder = function(graph) {
	return {
		get: function() {
			var orderedNodes = [];
			graph.forEachNode(function(node) {
				var inLinksLength = 0;
				graph.forEachLinkedNode(node.id, function(node, link) {
					if (link.toId === node.id) {
						inLinksLength += 1;
					}
				});
				if (!orderedNodes[inLinksLength]) {
					orderedNodes[inLinksLength] = [];
				}
				orderedNodes[inLinksLength].push(node);
			});
			var i = orderedNodes.length,
				result = [],
				place = 0;
			if (i > 0) {
				while (--i) {
					var products = orderedNodes[i];
					if (products) {
						place += 1;
						for (var j = 0; j < products.length; ++j) {
							result.push({
								id: products[j].id,
								place: place,
								rank: i,
								node: products[j]
							});
						}
					}
				}
			}
			return result;
		}
	};
};
/*global $ QuarkDG Q_DirectedGraph*/
QuarkDG.facebookGraphBuilder = function(graph, FB) {
	// 70*70 /5000 - the nearest to undocumented limit of records returned in one request. 
	var MAX_CHUNK = 70,
		potentialConnections = 0,
		currentUserId = parseInt(FB.getUserID(), 10),
		random = Q_DirectedGraph.random('I Love U *'),
		/**
		 * Function converts array to array of arrays with max size of a subarray equal to maxChunkSize
		 */
		chunkArray = function(array, maxChunkSize) {
			var l = array.length,
				fullChunks = l / maxChunkSize << 0,
				i, j,
				result = [];
			for (i = 0; i < fullChunks; ++i) {
				var chunk = [];
				for (j = i * maxChunkSize; j < (i + 1) * maxChunkSize; ++j) {
					chunk.push(array[j]);
				}
				result.push(chunk);
			}
			var lastChunk = [];
			for (j = fullChunks * maxChunkSize; j < array.length; ++j) {
				lastChunk.push(array[j]);
			}
			if (lastChunk.length) {
				result.push(lastChunk);
			}
			return result;
		},
		l = 0,
		addLink = function(from, to) {
			if (from === to) {
				return;
			}
			if (!graph.hasLink(from, to) && !graph.hasLink(to, from)) {
				graph.addLink(from, to);
			}
		},
		addToGraph = function(friendshipData) {
			for (var i = 0; i < friendshipData.length; ++i) {
				var uid1 = parseInt(friendshipData[i].uid1, 10),
					uid2 = parseInt(friendshipData[i].uid2, 10);
				addLink(uid1, uid2);
			}
		},
		analyze = function(idx, work, chunks, progress) {
			var currentWorkItem = work[idx],
				chunk1 = chunks[currentWorkItem.set1],
				chunk2 = chunks[currentWorkItem.set2],
				chunk1Users = '(' + chunk1.join(',') + ')',
				chunk2Users = '(' + chunk2.join(',') + ')',
				q = 'SELECT uid1, uid2 FROM friend where uid1 in ' + chunk1Users + ' AND uid2 in ' + chunk2Users + ' AND uid1 < uid2';
			FB.api('/fql', {
				q: q
			}, function(response) {
				if (progress.isCanceled()) {
					return;
				}
				idx += 1;
				var analyzed = Math.round(idx * potentialConnections / work.length);
				progress.update('Analyzed ' + analyzed + ' out of ' + potentialConnections + ' potential connections...');
				addToGraph(response.data);
				if (idx < work.length) {
					analyze(idx, work, chunks, progress);
				} else {
					progress.complete();
				}
			});
		},
		onFriendsGathered = function(response, startFromId, progress) {
			if (progress.isCanceled()) {
				return;
			}
			var profiles = response.data,
				friendIds = profiles.map(function(u) {
					return u.uid;
				}),
				chunks = chunkArray(friendIds, MAX_CHUNK),
				work = [],
				rootNode = graph.getNode(startFromId),
				rootPos = (rootNode && rootNode.position) || {
					x: 0,
					y: 0
				};
			potentialConnections = friendIds.length * (friendIds.length - 1) / 2; // Assume it's complete graph
			progress.update('Found ' + friendIds.length + ' friends. Analyzing friends connections...');
			graph.beginUpdate();
			for (var i = 0; i < profiles.length; ++i) {
				var profile = profiles[i];
				if (!graph.getNode(profile.uid)) {
					if (profile.uid == currentUserId) {
						profile.isPinned = true;
					}
					var node = graph.addNode(profile.uid, profile),
						angle = random.nextDouble() * Math.PI;
					node.position = {
						x: rootPos.x + Math.cos(angle) * 50,
						y: rootPos.y + Math.sin(angle) * 50
					};
				}
				addLink(startFromId, profile.uid);
			}
			graph.endUpdate();
			for (i = 0; i < chunks.length; ++i) {
				for (var j = i; j < chunks.length; ++j) {
					work.push({
						set1: i,
						set2: j
					});
				}
			}
			analyze(0, work, chunks, progress);
		},
		getFriendsList = function(startFromId, progress) {
			FB.api('/fql', {
				q: 'SELECT uid, name, pic_square, friend_count,sex,profile_url, is_app_user FROM user WHERE uid = ' + startFromId + ' OR uid IN (SELECT uid2 FROM friend WHERE uid1 = ' + startFromId + ')'
			},

			function(response) {
				onFriendsGathered(response, startFromId, progress);
			});
		};
	return {
		buildMyFriendsGraph: function() {
			var progress = QuarkDG.progressToken();
			FB.api('/fql', {
				q: 'SELECT uid, name, friend_count, sex,profile_url, pic_square FROM user WHERE uid = me() OR uid IN (SELECT uid2 FROM friend WHERE uid1 = me()) and is_app_user = 1'
			}, function(response) {
				var friends = response.data;
				getFriendsList(friends[0].uid, progress);
			});
			return progress;
		},
		addFriendsOfFriend: function(friendId) {
			var progress = QuarkDG.progressToken();
			getFriendsList(friendId, progress);
			return progress;
		}
	};
};
/*global Q_DirectedGraph */
Q_DirectedGraph.Graph.View.webglDualColorLine = function(start, end) {
	return {
		/**
		 * Gets or sets color of the line. If you set this property externally
		 * make sure it always come as integer of 0xRRGGBB format (no alpha channel);
		 */
		start: Q_DirectedGraph.Graph.View._webglUtil.parseColor(start),
		end: Q_DirectedGraph.Graph.View._webglUtil.parseColor(end)
	};
};
/* global Q_DirectedGraph Float32Array ArrayBuffer */
/**
 * Defines UI for links in webgl renderer.
 */
Q_DirectedGraph.Graph.View.webglDualColorLinkProgram = function() {
	var ATTRIBUTES_PER_PRIMITIVE = 6, // primitive is Line with two points. Each has x,y and color = 3 * 2 attributes.
		BYTES_PER_LINK = 2 * (Float32Array.BYTES_PER_ELEMENT * 2 + Uint32Array.BYTES_PER_ELEMENT), // 2 nodes * (x, y, rgba) 
		linksFS = [
			'precision mediump float;',
			'varying vec4 color;',
			'void main(void) {',
			'   gl_FragColor = color;',
			'}'].join('\n'),
		linksVS = [
			'attribute vec2 a_vertexPos;',
			'attribute vec4 a_color;',
			'uniform vec2 u_screenSize;',
			'uniform mat4 u_transform;',
			'varying vec4 color;',
			'void main(void) {',
			'   gl_Position = u_transform * vec4(a_vertexPos/u_screenSize, 0.0, 1.0);',
			'   color = a_color.abgr;',
			'}'].join('\n');
	var program,
	gl,
	buffer,
	utils,
	locations,
	linksCount = 0,
		frontLinkId, // used to track z-index of links.
		storage = new ArrayBuffer(1024 * BYTES_PER_LINK), // 1024 links by default
		positions = new Float32Array(storage),
		colors = new Uint32Array(storage),
		width, height, transform, sizeDirty,
		ensureEnoughStorage = function() {
			if ((linksCount + 1) * BYTES_PER_LINK > storage.byteLength) {
				// Every time we run out of space create new array twice bigger.
				// TODO: it seems buffer size is limited. Consider using multiple arrays for huge graphs
				var extendedStorage = new ArrayBuffer(storage.byteLength * 2),
					extendedPositions = new Float32Array(extendedStorage),
					extendedColors = new Uint32Array(extendedStorage);
				extendedColors.set(colors); // should be enough to copy just one view.
				positions = extendedPositions;
				colors = extendedColors;
				storage = extendedStorage;
			}
		};
	return {
		load: function(glContext) {
			gl = glContext;
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.enable(gl.BLEND);
			utils = Q_DirectedGraph.Graph.webgl(glContext);
			program = utils.createProgram(linksVS, linksFS);
			gl.useProgram(program);
			locations = utils.getLocations(program, ['a_vertexPos', 'a_color', 'u_screenSize', 'u_transform']);
			gl.enableVertexAttribArray(locations.vertexPos);
			gl.enableVertexAttribArray(locations.color);
			buffer = gl.createBuffer();
		},
		position: function(linkUi, fromPos, toPos) {
			var linkIdx = linkUi.id,
				offset = linkIdx * ATTRIBUTES_PER_PRIMITIVE;
			positions[offset] = fromPos.x;
			positions[offset + 1] = fromPos.y;
			colors[offset + 2] = linkUi.start;
			positions[offset + 3] = toPos.x;
			positions[offset + 4] = toPos.y;
			colors[offset + 5] = linkUi.end;
		},
		createLink: function(ui) {
			ensureEnoughStorage();
			linksCount += 1;
			frontLinkId = ui.id;
		},
		removeLink: function(ui) {
			if (linksCount > 0) {
				linksCount -= 1;
			}
			// swap removed link with the last link. This will give us O(1) performance for links removal:
			if (ui.id < linksCount && linksCount > 0) {
				utils.copyArrayPart(colors, ui.id * ATTRIBUTES_PER_PRIMITIVE, linksCount * ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
			}
		},
		updateTransform: function(newTransform) {
			sizeDirty = true;
			transform = newTransform;
		},
		updateSize: function(w, h) {
			width = w;
			height = h;
			sizeDirty = true;
		},
		render: function() {
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, storage, gl.DYNAMIC_DRAW);
			if (sizeDirty) {
				sizeDirty = false;
				gl.uniformMatrix4fv(locations.transform, false, transform);
				gl.uniform2f(locations.screenSize, width, height);
			}
			gl.vertexAttribPointer(locations.vertexPos, 2, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
			gl.vertexAttribPointer(locations.color, 4, gl.UNSIGNED_BYTE, true, 3 * Float32Array.BYTES_PER_ELEMENT, 8);
			gl.drawArrays(gl.LINES, 0, linksCount * 2);
			frontLinkId = linksCount - 1;
		},
		bringToFront: function(link) {
			if (frontLinkId > link.id) {
				utils.swapArrayPart(colors, link.id * ATTRIBUTES_PER_PRIMITIVE, frontLinkId * ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
			}
			if (frontLinkId > 0) {
				frontLinkId -= 1;
			}
		},
		getFrontLinkId: function() {
			return frontLinkId;
		}
	};
};
/* global Q_DirectedGraph Float32Array */
/**
 * Defines simple UI for nodes in webgl renderer. Each node is rendered as square. Color and size can be changed.
 */
Q_DirectedGraph.Graph.View.webglCustomNodeProgram = function() {
	var ATTRIBUTES_PER_PRIMITIVE = 4, // Primitive is point, x, y - its coordinates + color and size == 4 attributes per node. 
		nodesFS = [
			'precision mediump float;',
			'varying vec4 color;',
			'varying float pixelSize;',
			'void main(void) {',
			'   if (gl_PointCoord.x <= pixelSize || gl_PointCoord.x >= 1.0-pixelSize || gl_PointCoord.y <= pixelSize || gl_PointCoord.y >= 1. - pixelSize) {',
			'     gl_FragColor = vec4(color.xyz * 0.3, 1);',
			'   } else {',
			'     gl_FragColor = color;',
			'   }',
			'}'].join('\n'),
		nodesVS = [
			'attribute vec2 a_vertexPos;',
		// Pack clor and size into vector. First elemnt is color, second - size.
		// note: since it's floating point we can only use 24 bit to pack colors...
		// thus alpha channel is dropped, and is always assumed to be 1.
		'attribute vec2 a_customAttributes;',
			'uniform vec2 u_screenSize;',
			'uniform mat4 u_transform;',
			'varying vec4 color;',
			'varying float pixelSize;',
			'void main(void) {',
			'   gl_Position = u_transform * vec4(a_vertexPos/u_screenSize, 0, 1);',
			'   gl_PointSize = a_customAttributes[1] * u_transform[0][0];',
			'   float c = a_customAttributes[0];',
			'   color.b = mod(c, 256.0); c = floor(c/256.0);',
			'   color.g = mod(c, 256.0); c = floor(c/256.0);',
			'   color.r = mod(c, 256.0); c = floor(c/256.0); color /= 255.0;',
			'   color.a = 1.0;',
			'   pixelSize = 1.0/gl_PointSize;',
			'}'].join('\n');
	var program,
	gl,
	buffer,
	locations,
	utils,
	nodes = new Float32Array(64),
		nodesCount = 0,
		width, height, transform, sizeDirty;
	return {
		load: function(glContext) {
			gl = glContext;
			utils = Q_DirectedGraph.Graph.webgl(glContext);
			program = utils.createProgram(nodesVS, nodesFS);
			gl.useProgram(program);
			locations = utils.getLocations(program, ['a_vertexPos', 'a_customAttributes', 'u_screenSize', 'u_transform']);
			gl.enableVertexAttribArray(locations.vertexPos);
			gl.enableVertexAttribArray(locations.customAttributes);
			buffer = gl.createBuffer();
		},
		/**
		 * Updates position of node in the buffer of nodes.
		 *
		 * @param idx - index of current node.
		 * @param pos - new position of the node.
		 */
		position: function(nodeUI, pos) {
			var idx = nodeUI.id;
			nodes[idx * ATTRIBUTES_PER_PRIMITIVE] = pos.x;
			nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 1] = pos.y;
			nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 2] = nodeUI.color;
			nodes[idx * ATTRIBUTES_PER_PRIMITIVE + 3] = nodeUI.size;
		},
		updateTransform: function(newTransform) {
			sizeDirty = true;
			transform = newTransform;
		},
		updateSize: function(w, h) {
			width = w;
			height = h;
			sizeDirty = true;
		},
		createNode: function(node) {
			nodes = utils.extendArray(nodes, nodesCount, ATTRIBUTES_PER_PRIMITIVE);
			nodesCount += 1;
		},
		removeNode: function(node) {
			if (nodesCount > 0) {
				nodesCount -= 1;
			}
			if (node.id < nodesCount && nodesCount > 0) {
				utils.copyArrayPart(nodes, node.id * ATTRIBUTES_PER_PRIMITIVE, nodesCount * ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
			}
		},
		replaceProperties: function(replacedNode, newNode) {},
		render: function() {
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, nodes, gl.DYNAMIC_DRAW);
			if (sizeDirty) {
				sizeDirty = false;
				gl.uniformMatrix4fv(locations.transform, false, transform);
				gl.uniform2f(locations.screenSize, width, height);
			}
			gl.vertexAttribPointer(locations.vertexPos, 2, gl.FLOAT, false, ATTRIBUTES_PER_PRIMITIVE * Float32Array.BYTES_PER_ELEMENT, 0);
			gl.vertexAttribPointer(locations.customAttributes, 2, gl.FLOAT, false, ATTRIBUTES_PER_PRIMITIVE * Float32Array.BYTES_PER_ELEMENT, 2 * 4);
			gl.drawArrays(gl.POINTS, 0, nodesCount);
		}
	};
};

function main(FB) {
	var graph = Q_DirectedGraph.Graph.graph(),
		fbBuilder = QuarkDG.facebookGraphBuilder(graph, FB),
		progress = fbBuilder.buildMyFriendsGraph(),
		currentUser = parseInt(FB.getUserID(), 10),
		openDetails,
		colorCodeSex = true;
	var colors = ['#b3b3b3',
		'#D28E00',
		'#731DD6',
		'#0081E2',
		'#1FB084',
		'#35993A',
		'#B3D66F',
		'#D2C7FB',
		'#00CBCD',
		'#2A33D5',
		'#802466',
		'#899000'];
	var graphics = Q_DirectedGraph.Graph.View.webglGraphics(),
		progressChange = function(message) {
			var isDone = progress.isCompleted(),
				isError = isDone && message; // Succesful done has no message.
			if (isError) {
				$('#log').addClass('error').text(message);
			} else if (isDone) {
				

				var maxDegree = graph.getNodesCount();
				$('#log').text('Showing ' + maxDegree + ' friends').fadeOut(9000);
				graph.forEachLink(function(link) {
					if (link.fromId !== currentUser && link.toId !== currentUser) {
						return; // ignore this connection.
					} else {
						var friendId = link.fromId === currentUser ? link.toId : link.fromId,
							commonFriendsCount = graph.getLinks(friendId).length,
							mul = 0.9,
							weight = (commonFriendsCount - 1 / maxDegree) * maxDegree * (1 - mul) / (maxDegree * maxDegree - 1) + mul;
						link.force_directed_spring.weight = weight;
					}
				});
				if (openDetails) {
					showDetailedView(openDetails);
				}
			} else {
				$('#log').text(message);
			}
			//$('#log').css('margin-left', -$('#log').width() / 2);
		},
		resetProgressMessage = function() {
			$('#log')
				.removeClass('error')
				.stop(true, true)
				.text('Searching friends...')
				.show();
		},
		showFriends = function(node) {
			if (node.data.is_app_user && !node.data.friendsKnown) {
				// todo: what if user clicks while old graph is building?
				var progress = fbBuilder.addFriendsOfFriend(node.id);
				resetProgressMessage();
				progress.update(progressChange);
				node.data.friendsKnown = true;
			}
		},
		showQuickPreview = function(node) {
			var hoveredName = $('#hoveredName'),
				img = '<br/><img src="https://graph.facebook.com/' + node.id + '/picture?type=large" alt="' + node.data.name + '"></img>';
			hoveredName.empty().text(node.data.name).append(img).show();
		},
		hideQuickPreview = function() {
			setTimeout(function() {
				$('#hoveredName').hide().empty();
			}, 1500);
		},
		hideDetails = function() {
			$('#detailedInfo').hide();
		},
		showDetailedView = function(node) {
			var details = $('#detailedInfo'),
				avatarUrl = 'https://graph.facebook.com/' + node.id + '/picture?type=large',
				person = node.data,
				oldAvatar = $('#imgAvatar', details),
				newAvatar = oldAvatar.clone(),
				title = $('#name', details);
			openDetails = node;
			oldAvatar.remove();
			newAvatar.attr('src', '').attr('src', avatarUrl).insertAfter(title);
			title.text(person.name);
			$('#friendsShown', details).text(graph.getLinks(node.id).length);
			var friendsCount = typeof person.friend_count === 'number' ? person.friend_count : 'N/A';
			$('#friendsCount', details).text(friendsCount);
			var actionLink = $('#send_request_or_build_net');
			var isMyFriend = graph.hasLink(currentUser, node.id) || graph.hasLink(node.id, currentUser);
			$('#request_sent_info').remove();
			if (person.is_app_user && !person.friendsKnown && isMyFriend) {
				actionLink.text('Show ' + person.name + '\'s friends')
					.show()
					.unbind('click')
					.click(function() {
					showFriends(node);
				});
			} else if (!isMyFriend) {
				// potential friend:
				if (!node.friendRequestSent) {
					actionLink.text('Send friend request...')
						.show()
						.unbind('click')
						.click(function() {
						FB.ui({
							method: 'friends.add',
							id: node.id
						},

						function(r) {
							if (r && r.action === true) {
								actionLink.hide().after('<div id="request_sent_info">Friend request sent</div>');
								node.friendRequestSent = true;
							}
						});
					});
				} else {
					actionLink.hide().after('<div id="request_sent_info">Friend request sent</div>');
				}
			}
			$('#removeFromVisualization', details)
				.unbind('click')
				.click(function() {
				graph.removeNode(node.id);
				hideDetails();
			});
			// TODO: end friend with current user
			$('#gotoFacebook', details).attr('href', person.profile_url);
			node.selectedColor = node.selectedColor || $('.color_select').first();
			if (node.selectedColor) {
				$('.color_select').removeClass('selected_color');
				node.selectedColor.addClass('selected_color');
			}
			details.show();
		},
		setSvgGraphics = function(graphics) {
			graphics.node(function(node) {
				var ui = Q_DirectedGraph.Graph.svg('g'),
					img = Q_DirectedGraph.Graph.svg('image').attr('width', 64).attr('height', 64).link(node.data.pic_square);
				ui.append(img);
				$(ui).hover(function() {
					showQuickPreview(node);
				}, function() {
					hideQuickPreview();
				}).dblclick(function(e) {
					e.stopPropagation();
					showFriends(node);
				}).click(function(e) {
					e.stopPropagation();
					showDetailedView(node);
				});
				return ui;
			}).placeNode(function(nodeUI, pos) {
				nodeUI.attr("transform", "translate(" + (pos.x - 32) + ", " + (pos.y - 32) + ")");
			});
		},
		GIRLS_COLOR = 0xf50c8b,
		BOYS_COLOR = 0x009ee8,
		IT_COLOR = 0xcccccc,
		updateColors = function() {
			graph.forEachNode(function(node) {
				var sexColor = BOYS_COLOR,
					sex = node.data.sex;
				if (colorCodeSex) {
					if (sex === 'female') {
						sexColor = GIRLS_COLOR;
					} else if (sex !== 'male') {
						sexColor = IT_COLOR;
					}
				}
				node.ui.color = sexColor;
			});
			renderer.rerender();
		},
		setWebglGraphcis = function(graphics) {
			graphics.setNodeProgram(Q_DirectedGraph.Graph.View.webglCustomNodeProgram());
			graphics.node(function(node) {
				var sexColor = BOYS_COLOR,
					sex = node.data.sex;
				if (colorCodeSex) {
					if (sex === 'female') {
						sexColor = GIRLS_COLOR;
					} else if (sex !== 'male') {
						sexColor = IT_COLOR;
					}
				}
				var img = Q_DirectedGraph.Graph.View.webglSquare(55, sexColor);
				return img;
			})
				.link(function(link) {
				var line = Q_DirectedGraph.Graph.View.webglLine(0xb3b3b3ff);
				line.oldColor = 0xb3b3b3ff;
				return line;
			});
			var events = Q_DirectedGraph.Graph.webglInputEvents(graphics, graph),
				lastHovered = null,
				colorLinks = function(node, color) {
					if (node && node.id) {
						graph.forEachLinkedNode(node.id, function(node, link) {
							link.ui.color = color || link.ui.oldColor;
						});
					}
				};
			events.mouseEnter(function(node) {
				showQuickPreview(node);
				colorLinks(lastHovered);
				lastHovered = node;
				graph.forEachLinkedNode(node.id, function(node, link) {
					link.ui.color = 0xff0000ff;
					graphics.bringLinkToFront(link.ui);
				});
				renderer.rerender();
			}).mouseLeave(function(node) {
				hideQuickPreview();
				colorLinks(lastHovered);
				lastHovered = null;
				colorLinks(node);
				renderer.rerender();
			}).dblClick(function(node) {
				showFriends(node);
			}).click(function(node) {
				showDetailedView(node);
			});
		},
		renderLinks = true,
		highlightNode = function(node) {
			if (isWebgl) {
				node.ui.size = 500;
			}
		},
		svgLayoutSettings = {
			springLength: 300,
			springCoeff: 0.00003,
			dragCoeff: 0.0005,
			gravity: -1000,
			theta: 0.5
		},
		webglLayoutSettings = {
			springLength: 300,
			springCoeff: 0.00003,
			dragCoeff: 0.0005,
			gravity: -1000,
			theta: 0.5
		},
		isWebgl = graphics.isSupported(),
		layout = Q_DirectedGraph.Graph.Layout.forceDirected(graph, isWebgl ? webglLayoutSettings : svgLayoutSettings);
	if (isWebgl) {
		setWebglGraphcis(graphics);
	} else {
		graphics = Q_DirectedGraph.Graph.View.svgGraphics();
		$('.no_webgl').show();
		renderLinks = true;
		setSvgGraphics(graphics);
	}
	var renderer = Q_DirectedGraph.Graph.View.renderer(graph, {
		container: document.getElementById('visualization'),
		graphics: graphics,
		layout: layout,
		renderLinks: renderLinks
	});
	resetProgressMessage();
	progress.update(progressChange);
	renderer.run();
	$('.sidebar-close').click(function() {
		hideDetails();
		openDetails = null;
	});
	$('#searchForm').submit(function(e) {
		var searchTerm = $('#searchName').val(),
			rNameMatch,
			lastFoundPerson;
		if (searchTerm) {
			rNameMatch = new RegExp('\\b' + searchTerm, 'ig');
		}
		graph.forEachNode(function(node) {
			var person = node.data;
			if (searchTerm && person.name.match(rNameMatch)) {
				highlightNode(node);
				lastFoundPerson = node;
			} else {
				node.ui.size = 50;
			}
		});
		if (lastFoundPerson) {
			showDetailedView(lastFoundPerson);
		}
		renderer.rerender();
		e.preventDefault();
		return false;
	});
	if (isWebgl) {
		$('#searchForm').show();
		var linksColor = $('#linksColor'),
			rColor = /rgb\((\d+), (\d+), (\d+)\)/;
		linksColor.append('<div class="color_select selected_color" style="background-color:' + colors[0] + '"></div>');
		for (var i = 1; i < colors.length; ++i) {
			linksColor.append('<div class="color_select" style="background-color:' + colors[i] + '"></div>');
		}
		$('.color_select').click(function() {
			$('.color_select').removeClass('selected_color');
			var colorCss = $(this).css('background-color'),
				colorMatch = colorCss.match(rColor),
				r = parseInt(colorMatch[1], 10),
				g = parseInt(colorMatch[2], 10),
				b = parseInt(colorMatch[3], 10),
				rgb = ((b + g * 256 + r * 256 * 256) << 8) | 0xff;
			$(this).addClass('selected_color');
			graph.forEachLinkedNode(openDetails.id, function(node, link) {
				link.ui.color = rgb;
				link.ui.oldColor = rgb;
				graphics.bringLinkToFront(link.ui);
			});
			renderer.rerender();
			openDetails.selectedColor = $(this);
		});
	}
	g = graph;
	l = layout;
}