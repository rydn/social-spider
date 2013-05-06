var facebook = require('../lib/facebook.js'),
	fs = require('fs'),
	_ = require('underscore'),
	mongoose = require('mongoose'),
	Friends = require('../models/Friends.js'),
	MutualFriends = require('../models/MutualFriends.js');
/**
 * collects mutual friends of supplied user object and stores results in db
 * @param  {Kue_Job}   job  [ The job in the Kue ]
 * @param  {Function} done [ callback ]
 */
module.exports = function (job, done) {
	//  get all user friends
	facebook.get(job.data.access_token, '/me/friends', function (result) {
		result = JSON.parse(result.toString());
		// new model
		var myFriends = new Friends({
			me: job.data.userid,
			friends: result.data,
			jobID: job.data.jobID
		});
		//  save model
		myFriends.save(function (err) {
			if (err) console.log(err);
			var resultingFriends = {};
			var totalCount = result.data.length;
			var counter = 0;
			//  iterate each friend getting friends
			_.each(result.data, function (friend) {
				//  get mutual friends for each of the users friends
				facebook.get(job.data.access_token, '/me/mutualfriends/' + friend.id, function (mutualfriends) {
					counter++;
					var mutualfriendsResult = JSON.parse(mutualfriends.toString());
					resultingFriends[friend.id] = mutualfriendsResult.data;
					var myMutualFriends = new MutualFriends({
						me: job.data.userid,
						fid: friend.id,
						mutualfriends: mutualfriendsResult.data,
						count: mutualfriendsResult.data.length,
						jobID: job.data.jobID
					});
					//  save to db
					myMutualFriends.save(function (err) {
						job.log(counter + '/' + totalCount + ' - Processed: "' + friend.name + '", ' + mutualfriendsResult.data.length + ' mutual friends found');
						job.progress(counter, totalCount);
						if (counter == totalCount) {
							done(null, resultingFriends);
						}
					});
				});
			});
		});
	});
};