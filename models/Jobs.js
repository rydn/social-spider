var mongoose = require('mongoose');
/**
 * [Friends description]
 * @type {Model}
 * @params
 * [ friends Friends of user ],
 * [ me	Userid of requesting user ]
 */
module.exports = mongoose.model('Jobs', {
	type: String,
	jobID: String,
	started: Date,
	ended: Date,
	status: String,
	data: {
		access_token: String,
		userid: Number
	}
});