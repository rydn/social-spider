/*
 * GET home page.
 */
var fs = require('fs');
exports.index = function (req, res) {
	var html = fs.readFileSync('views/layout.jshtml');
	res.send(html.toString());
};
exports.getFriends = require('./getFriends.js');
exports.getMutualFriends = require('./getMutualFriends.js');
exports.getGraphData = require('./getGraphData.js');