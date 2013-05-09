/**
 * Module dependencies.
 */
var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    jobQueue = require('./lib/queue.js'),
    Job = require('./models/Jobs.js'),
    mongoose = require('mongoose'),
    path = require('path');
mongoose.connect('mongodb://localhost/social_spider');
var app = express();
//  configuration
app.configure(function() {
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
app.configure('development', function() {
    app.use(express.errorHandler());
});
app.engine('jshtml', require('jshtml-express'));
app.set('view engine', 'jshtml');
////////////
//  Paths //
////////////
app.get('/', routes.index);
// get friends from userid
app.get('/api/:me/friends', routes.getFriends);
//  get shared friends from a friend
app.get('/api/:me/mutualfriends/:fid', routes.getMutualFriends);
//  get data formatted for graph
app.get('/api/:me/graphdata', routes.getGraphData);
//  start web server
var webserver = http.createServer(app)
    .listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
    jobQueue.startInterface('Social-Spider | Queue', 5598);
    console.log('Kue interface listening on port 5598');
});
//  start websocket server
var io = require('socket.io')
    .listen(webserver);
//  configure websockets
io.enable('browser client minification'); // send minified client
io.enable('browser client etag'); // apply etag caching logic based on version number
io.enable('browser client gzip'); // gzip the file
io.set('log level', 1); // reduce logging
// enable all transports (optional if you want flashsocket support, please note that some hosting
// providers do not allow you to create servers that listen on a port different than 80 or their
// default port)
io.set('transports', [
    'websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);
//  on new client connection
io.sockets.on('connection', function(socket) {
    console.log('New connected client');
    /*
    socket events
    */
    //  on client auth with facebook
    socket.on('fb.response', function(response) {
        console.log('New facebook user connected, userid: ' + response.authResponse.userID + ' status: ' + response.status);
    });
    //  initiate collecting mutual friends
    socket.on('fb.friendsCollect', function(details) {
        console.log('Collecting friends for: ' + details.userid);
        if (details.access_token) {
            jobQueue.enqueue('getFriends', {
                access_token: details.access_token,
                userid: details.userid
            }, function(err, job) {
                if (!err) {
                    var currentJob = new Job({
                        type: 'getFriends',
                        jobID: job.data.jobID,
                        started: new Date()
                            .getTime(),
                        ended: null,
                        status: 'Queued',
                        data: {
                            access_token: job.data.access_token,
                            userid: job.data.userid
                        }
                    });
                    currentJob.save(function(err) {
                        if (err) socket.emit('fb.friendsCollect.failed', {
                            job: job,
                            timestamp: new Date()
                                .getTime(),
                            err: err
                        });
                        else socket.emit('fb.friendsCollect.start', job);
                    });
                    // bind event handlers
                    job.on('complete', function() {
                        currentJob.status = 'complete';
                        currentJob.ended = new Date()
                            .getTime();
                        currentJob.save(function(err) {
                            if (err) console.log(err);
                            else {
                                var timetaken = currentJob.ended - currentJob.started;
                                console.log("Job: task: 'getFriends', jobID: '" + currentJob.jobID + "', completed in: " + timetaken);
                                socket.emit('fb.friendsCollect.complete', {
                                    job: job,
                                    time: {
                                        started: currentJob.started,
                                        ended: currentJob.ended
                                    },
                                    timestamp: new Date()
                                        .getTime()
                                });
                            }
                        });
                    })
                        .on('failed', function() {
                        currentJob.status = 'failed';
                        currentJob.ended = new Date()
                            .getTime();
                        currentJob.save(function(err) {
                            socket.emit('fb.friendsCollect.failed', {
                                job: job,
                                timestamp: new Date()
                                    .getTime()
                            });
                        });
                    })
                        .on('progress', function(progress) {
                        if (currentJob.status !== 'processing') {
                            currentJob.status = 'processing';
                            currentJob.save();
                        }
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
    socket.on('disconnect', function() {
        console.log('Client disconnect.');
    });
});