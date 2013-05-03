/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    jobQueue = require('./lib/queue.js'),
    path = require('path');

var app = express();


app.configure(function() {
    app.set('port', process.env.PORT || 5599);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jshtml');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('your secret here'));
    app.use(express.session());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
    app.use(express.errorHandler());
});

app.engine('jshtml', require('jshtml-express'));
app.set('view engine', 'jshtml');

////////////
//  Paths //
////////////
app.get('/', routes.index);
app.get('/users', user.list);
//  post auth get details
app.post('/fb/init', function(req, res) {
    if (req.body.access_token) {
        jobQueue.enqueue('getFriends', {
            access_token: req.body.access_token,
            userid: req.body.userid
        }, function(err, job) {
            if (!err) {
                // bind event handlers
                job.on('complete', function() {
                    console.log("Job: 'getFriends', is complete");
                    res.json();
                }).on('failed', function() {
                    console.log("Job: 'getFriends', failed");
                }).on('progress', function(progress) {
                    process.stdout.write('\r  job #' + job.id + ' ' + progress + '% complete');
                });
                // process job
                jobQueue.processQueue('getFriends');
                
            } else res.json({
                hasErr: true,
                err: 'failed to enqueue job'
            });
        });

    } else {
        res.json({
            hasErr: true,
            err: 'No access token provided'
        })
    }
});
//  start server
http.createServer(app).listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
    jobQueue.startInterface('Social-Spider | Queue', 5598);
    console.log('Kue interface listening on port 5598')
});