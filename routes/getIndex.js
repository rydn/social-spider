var fs = require('fs');
module.exports= function (req, res) {
	var html = fs.readFileSync('views/layout.jshtml');
	res.send(html.toString());
};