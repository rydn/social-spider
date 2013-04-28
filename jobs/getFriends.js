var facebook = require('../lib/facebook.js'),
    _ = require('underscore');
module.exports = function(job, done) {
    
    facebook.get(job.data.access_token, '/me/friends', function(result) {
        result = JSON.parse(result.toString());

        var resultingFriends = {};
        var totalCount = result.data.length;
        var counter = 0;
        console.log('Getting ' + totalCount + ' related entities');
        //	iterate each friend getting friends 
        _.each(result.data, function(friend) {

            facebook.get(job.data.access_token, '/me/mutualfriends/' + friend.id, function(result) {
            	var mutualfriendsResult = JSON.parse(result.toString());
                 job.log('Processed ' + friend.name + ', ' + mutualfriendsResult.data.length + ' mutual friends found');
                counter++;
                resultingFriends[friend.id] = mutualfriendsResult.data;
                job.progress(counter, totalCount);
                if (counter == totalCount) {
                	console.log(require('util').inspect(resultingFriends));
                    done(null, resultingFriends);
                }
            });
        });

    })
};