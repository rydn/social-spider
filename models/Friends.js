var mongoose = require('mongoose');
/**
 * [Friends description]
 * @type {Model}
 * @params 
 * [ friends Friends of user ], 
 * [ me	Userid of requesting user ]
 */
module.exports = mongoose.model('Friends', {
	friends: Array,
	me: Number
});