	var mongoose = require('mongoose'),
		Friends = require('../models/Friends.js');
	module.exports = function(req, res) {
		if (req.params.me) {
			Friends.find({
				me: req.params.me
			}, function(err, friends) {
				if (err) res.json({
					hasErr: true,
					err: err
				});
				else res.json(friends[0].friends);
			});
		} else {
			res.json({
				hasErr: true,
				err: 'Missing me'
			});
		}
	};