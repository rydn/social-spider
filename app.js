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
app.configure(function () {
    app.set('port', process.env.PORT || 5599);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jshtml');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('m33p.or.m00p'));
    app.use(express.session());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});
app.configure('development', function () {
    app.use(express.errorHandler());
});
app.engine('jshtml', require('jshtml-express'));
app.set('view engine', 'jshtml');
////////////
//  Paths //
////////////
app.get('/', routes.index);
app.get('/models/:modelName', function (req, res) {
    var modelName = req.params.modelName;
    console.log(modelName);
});
//  start web server
var webserver = http.createServer(app)
    .listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
    jobQueue.startInterface('Social-Spider | Queue', 5598);
    console.log('Kue interface listening on port 5598');
});
//  start websocket server
var io = require('socket.io')
    .listen(webserver);
io.sockets.on('connection', function (socket) {
    console.log('New connected client');
    /*
    socket events
    */
    //  on client auth with facebook
    socket.on('fb.response', function (response) {
        console.log('New facebook user connected, userid: ' + response.authResponse.userID + ' status: ' + response.status);
    });
    //  initiate collecting mutual friends
    socket.on('fb.friendsCollect', function (details) {
        console.log('Collecting friends for: '+details.userid);
        if (details.access_token) {
            jobQueue.enqueue('getFriends', {
                access_token: details.access_token,
                userid: details.userid
            }, function (err, job) {
                if (!err) {
                    socket.emit('fb.friendsCollect.start', job);
                    // bind event handlers
                    job.on('complete', function () {
                        console.log("Job: 'getFriends', is complete");
                        socket.emit('fb.friendsCollect.complete', {
                            job: job,
                            timestamp: new Date()
                                .getTime()
                        });
                    })
                        .on('failed', function () {
                        socket.emit('fb.friendsCollect.failed', {
                            job: job,
                            timestamp: new Date()
                                .getTime()
                        });
                    })
                        .on('progress', function (progress) {
                        process.stdout.write('\r  job #' + job.id + ' ' + progress + '% complete');
                        socket.emit('fb.friendsCollect.progress', {
                            job: job,
                            timestamp: new Date()
                                .getTime(),
                            progress: progress
                        });
                    });
                    // process job
                    jobQueue.processQueue('getFriends');
                } else socket.emit('fb.friendsCollect.failed', {
                    hasErr: true,
                    err: 'failed to enqueue job'
                });
            });
        } else socket.emit('fb.friendsCollect.failed', {
            hasErr: true,
            err: 'No access token provided'
        });
    });
    //  on client disconnect
    socket.on('disconnect', function () {
        console.log('Client disconnect.');
    });
});