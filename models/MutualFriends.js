var mongoose = require('mongoose');
/**
 * [MutualFriends model for storing mutual friends]
 * @type {Model}
 *
 * @params
 * [me User Id],
 * [fid Users Friends Id],
 * [mutualfriends Friends shared between user and friend]
 */
module.exports = mongoose.model('MutualFriends', {
	me: Number,
	fid: Number,
	mutualfriends: Array,
	count: Number
});