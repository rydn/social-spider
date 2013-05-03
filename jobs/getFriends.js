var facebook = require('../lib/facebook.js'),
    fs = require('fs'),
    _ = require('underscore'),
    mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/social_spider');
/**
 * <=== MODELS ===>
 */
/**
 * [Friends description]
 * @type {[type]}
 */
var Friends = mongoose.model('Friends', {
    friends: Array,
    me: Number
});
/**
 * [MutualFriends model for storing mutual friends]
 * @type {Model}
 *
 * @params
 * [me User Id],
 * [fid Users Friends Id],
 * [mutualfriends Friends shared between user and friend]
 */
var MutualFriends = mongoose.model('MutualFriends', {
    me: Number,
    fid: Number,
    mutualfriends: Array,
    count:Number
});
module.exports = function(job, done) {
    facebook.get(job.data.access_token, '/me/friends', function(result) {
        result = JSON.parse(result.toString());
        // new model
        var myFriends = new Friends({
            me: job.data.userid,
            friends: result.data
        });
        //  save model
        myFriends.save(function(err) {
            if (err) console.log(err);
            var resultingFriends = {};
            var totalCount = result.data.length;
            var counter = 0;
            //  iterate each friend getting friends
            _.each(result.data, function(friend) {
                facebook.get(job.data.access_token, '/me/mutualfriends/' + friend.id, function(mutualfriends) {
                    counter++;
                    var mutualfriendsResult = JSON.parse(mutualfriends.toString());
                    resultingFriends[friend.id] = mutualfriendsResult.data;
                    var myMutualFriends = new MutualFriends({
                        me: job.data.userid,
                        fid: friend.id,
                        mutualfriends: mutualfriendsResult.data,
                        count: mutualfriendsResult.data.length
                    });
                    myMutualFriends.save(function(err) {
                        job.log(counter+'/'+totalCount+' - Processed: "' + friend.name + '", ' + mutualfriendsResult.data.length + ' mutual friends found');
                        job.progress(counter, totalCount);
                        if (counter == totalCount) {
                            done(null, resultingFriends);
                        }
                    });

                });
            });
        });
    })
};