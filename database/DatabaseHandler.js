var mongoose = require('mongoose');

var User = require('./schema/User');
var Accident = require('./schema/Accident');
var Message = require('./schema/Message');
var CrtPlace = require('./schema/CrtPlace');
var Log = require('./schema/Log');
var BlacklistedToken = require('./schema/BlacklistedToken');

var config = require('../config');
module.exports.init = function(initCallback) {
    mongoose.connect(config.database);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function(callback) {
        //Load all data schemas
        module.exports.User = User;
        module.exports.Accident = Accident;
        module.exports.Message = Message;
        module.exports.CrtPlace = CrtPlace;
        module.exports.Log = Log;
        module.exports.BlacklistedToken = BlacklistedToken;
        console.log('Connected to database (' + config.database + ')');
        initCallback();
    });
};