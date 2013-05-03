var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/social_spider');

/**
 * [Friends description]
 * @type {[type]}
 */
var Friends = mongoose.model('Friends', {
    id: Number,
    name: String,
    me: Number
});
/**
 * [MutualFriends model for storing mutual friends]
 * @type {Model}
 * 
 * @params 
 * [me User Id], 
 * [id Users Friends Id], 
 * [mutualfriends Friends shared between user and friend]
 */
var MutualFriends = mongoose.model('MutualFriends', {
    me: Number,
    id: Number,
    mutualfriends: Array
});