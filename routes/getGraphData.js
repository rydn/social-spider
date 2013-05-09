var mongoose = require('mongoose'),
	_ = require('underscore'),
	Friends = require('../models/Friends.js'),
	MutualFriends = require('../models/MutualFriends.js');
module.exports = function(req, res) {
	if (req.params.me) {
		Friends.find({
			me: req.params.me
		}, function(err, friends) {
			if (err) res.json({
				hasErr: true,
				err: err
			});
			else {
				var friendsCollect = [];
				var graphDataMutual = [];
				_.each(friends[0].friends, function(friend, findex, fcontext) {
					friendsCollect.push({
						index: findex,
						id: Number(friend.id),
						name: friend.name,
						type: 'friend',
						hlink: 'http://www.facebook.com/' + friend.id,
						weight: 0
					});
					MutualFriends.find({
						me: req.params.me,
						fid: friend.id
					}, function(err, sharedFriends) {
						var count = 0;
						var returnMap = _.map(sharedFriends[0].mutualfriends, function(mutualfriend) {
							count++;
							return {
								index: count,
								source: friend,
								target: mutualfriend,
								linkName: 'facebook friend',
								sourceId: friend.id,
								targetId: mutualfriend.id
							};
						});
						graphDataMutual.push(returnMap[0]);
						if ((findex + 1) >= fcontext.length) {
							console.log('nodes: ' + friendsCollect.length, 'links: ' + graphDataMutual.length);
							res.json({
								links: friendsCollect,
								nodes: graphDataMutual
							});
						}
					});
				});
			}
		});
	} else {
		res.json({
			hasErr: true,
			err: 'Missing params'
		});
	}
};