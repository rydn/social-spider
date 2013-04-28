
/*
 * GET home page.
 */
var fs = require('fs');
exports.index = function(req, res){
	 var html = fs.readFileSync('views/layout.jshtml');
	 res.send(html.toString());
};