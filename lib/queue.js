var kue = require('kue'),
    genUUID = require('./genUUID.js'),
    jobs = kue.createQueue();

module.exports = {
    enqueue: function(name, data, callback) {
        data.jobID = genUUID();
        var job = jobs.create(name, data).save();
        callback(null, job);
    },
    startInterface: function(title, port) {
        kue.app.set('title', title);
        kue.app.listen(port);
    },
    processQueue: function(jobName) {
        //	get worker 
        var worker = require('../jobs/' + jobName + '.js');
        jobs.process(jobName, worker);

    }
}