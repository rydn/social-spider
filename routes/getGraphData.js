var mongoose = require('mongoose'),
	_ = require('underscore'),
	Friends = require('../models/Friends.js'),
	MutualFriends = require('../models/MutualFriends.js');
module.exports = function (req, res) {
	if (req.params.me) {
		Friends.find({
			me: req.params.me
		}, function (err, friends) {
			if (err) res.json({
				hasErr: true,
				err: err
			});
			else {
				var graphDataMutual = [];
				var graphDataFriends = _.map(friends[0].friends, function (item) {
					return {
						source: req.params.me,
						target: item.id,
						value: 1
					};
				});
				_.each(friends[0].friends, function (friend, findex, fcontext) {
					MutualFriends.find({
						me: req.params.me,
						fid: friend.id
					}, function (err, sharedFriends) {
						var returnMap = _.map(sharedFriends[0].mutualfriends, function (mutualfriend) {
							return {
								source: friend.id,
								target: mutualfriend.id,
								value: 1
							};
						});
						graphDataMutual.push(returnMap);
						if ((findex + 1) >= fcontext.length) {
							var completevar = _.union(graphDataMutual, graphDataFriends);
							console.log(graphDataFriends.length, graphDataMutual.length, completevar.length);
							res.json(completevar);
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