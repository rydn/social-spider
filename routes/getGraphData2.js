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
					MutualFriends.find({
						me: req.params.me,
						fid: friend.id
					}, function(err, sharedFriends) {
						sharedFriends = sharedFriends[0];
						friendsCollect.push({
							id: friend.id,
							name: friend.name,
							mutualfriends: sharedFriends.mutualfriends,
							type: friend
						});
						if ((findex + 1) >= fcontext.length) {
							res.json({nodes:friendsCollect});
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
