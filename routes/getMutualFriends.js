var mongoose = require('mongoose'),
	MutualFriends = require('../models/MutualFriends.js');
module.exports = function (req, res) {
	if ((req.params.me) && (req.params.fid)) {
		MutualFriends.find({
			me: req.params.me,
			fid: req.params.fid
		}, function (err, mutualFriends) {
			if (err) res.json({
				hasErr: true,
				err: err
			});
			else res.json(mutualFriends);
		});
	} else {
		res.json({
			hasErr: true,
			err: 'Missing userID or friendsID'
		});
	}
};