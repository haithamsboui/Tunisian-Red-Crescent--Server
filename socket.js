var socketio = require('socket.io');
var database = require('./database/DatabaseHandler');
var webservice = require('./api/v1/webservice');
var config = require('./config');
var utils = require('./utils');

//Socket io clients
var sockets = {}; //Stored as a hashmap instead of array for faster search by socket.id
//Attach Socket.IO to the server
module.exports.Attach = function(server) {
    var io = socketio.listen(server);

    module.exports.ReportAccident = function(accident) {
        for (var id in sockets) {
 console.log(sockets[id].User.Sharing);
            if (sockets[id].User.Sharing == true) {
                // sockets[id].emit('Accident1',accident);
 
                sockets[id].socket.emit('Accident1', accident);
                if (utils.DistanceBetween(sockets[id].User.Location, accident.Location) <= config.membersRange) {
                    sockets[id].socket.emit('Accident', accident);
                 }
            }
        }
        LogSockets('Accident');
    };

    module.exports.SendMessage = function(message) {
        for (var id in sockets) {
            var alreadySent = false;
            message.Audience.forEach(function(item) {
                if (!alreadySent) {
                    if ((sockets[id].User.IsAdmin == true && item == "Admins")) {
                        sockets[id].socket.emit('Message', message);
                        alreadySent = true;
                    }
                    else if ((sockets[id].User.IsMember == true && item == "Members")) {
                        sockets[id].socket.emit('Message', message);
                        alreadySent = true;
                    }
                    else if (sockets[id].User.UserID && item == "Users") {
                        sockets[id].socket.emit('Message', message);
                        alreadySent = true;
                    }
                    else if (sockets[id].User.UserID == item) {
                        sockets[id].socket.emit('Message', message);
                        alreadySent = true;
                    }
                }
            });
        }
        LogSockets('Message');
    };

    module.exports.AccidentHandled = function(accident) {
        for (var id in sockets) {
            //if (sockets[id].User.Sharing == true) {
            sockets[id].socket.emit('AccidentHandled', accident);
            //}
        }
        LogSockets('AccidentHandled');
    };
    io.on('connection', function(socket) {
        console.log("Connected");
        sockets[socket.id] = {
            socket: socket,
            User: {}
        };
        var sharingUsers = [];
        for (var id in sockets) {
            if (sockets[id].User.Sharing == true) {
                sharingUsers.push({
                    id: id,
                    Location: sockets[id].User.Location //Blood Type, Level
                });
            }
        }
        socket.emit('Members', sharingUsers);
      
      
        socket.on('Members', function() {
            var sharingUsers = [];
            for (var id in sockets) {
                if (sockets[id].User.Sharing == true) {
                    sharingUsers.push({
                        id: id,
                        Location: sockets[id].User.Location //Blood Type, Level
                    });
                }
            }
            console.log('Members : ' + JSON.stringify(sharingUsers));
            socket.emit('Members', sharingUsers);
        });

        LogSockets('connection');

        socket.on('disconnect', function() {
            if (sockets[socket.id].User.Sharing == true) {
                io.emit('SharingOFF', {
                    id: socket.id
                });
            }
            if (sockets[id].User.UserID && sockets[id].User.Location) {
                database.User.findByIdAndUpdate(sockets[id].User.UserID, {
                    $set: {
                        Location: sockets[id].User.Location
                    }
                }, function(err, user) {
                    if (err) {
                        console.log('Failed to save location on socket disconnect.' + err);
                    }
                });
            }
            delete sockets[socket.id];
            LogSockets('disconnect');

        });
        socket.on('access_token', function(data) {
            LogSockets('access_token');
            if (sockets[socket.id].User.UserID) {
                return;
            }
            webservice.TestToken(data, function(err, decoded) {
                if (err) {
                    socket.emit('access_token', {
                        success: false,
                        message: 'Bad access_token.'
                    });
                    return;
                }
                socket.emit('access_token', {
                    success: true,
                    message: 'access_token verified.'
                });
                sockets[socket.id].User.UserID = decoded.UserID;
                sockets[socket.id].User.IsMember = decoded.IsMember;
                sockets[socket.id].User.IsAdmin = decoded.IsAdmin;

                if (sockets[socket.id].User.IsMember == true) {
                    socket.on('Location', function(data) {
                        sockets[socket.id].User.Location = data.Location;
                        io.emit('Location', {
                            id: socket.id,
                            user: sockets[socket.id].User.id,
                            Location: sockets[socket.id].User.Location
                        });
                        //LogSockets('Location');

                    });
                    socket.on('SharingOFF', function() {
                        
                        sockets[socket.id].User.Sharing = false;
                        io.emit('SharingOFF', {
                            id: socket.id
                        });

                        LogSockets('SharingOFF');
                    });

                    socket.on('SharingON', function(data) {
                        sockets[socket.id].User.Sharing = true;
                        sockets[socket.id].User.Location = data.Location;

                        io.emit('SharingON', {
                            id: socket.id,
                            user: sockets[id].User.UserID,
                            Location: data.Location //Blood Type, Level
                        });
                        LogSockets('SharingON');
                    });
                }
            });
        });

        //Echo Test
        if (config.debug) {
            socket.on('message', function(data) {
                console.log('message from ' + socket.id + ' : ' + data);
                io.emit('message', data);
            });
            socket.on('tizen', function() {
                console.log('######## TIZEN ASSHOLES TEAM ARE TESTING THE APP ' + utils.dateFormat(Date.now(), "DD/MM/YYYY HH:mm:ss") + ' !!! ########');
            });
            socket.on('ios', function() {
                //console.log('######## tesing ios app ' + utils.dateFormat(Date.now(), "DD/MM/YYYY HH:mm:ss") + ' !!! ########');
                console.log("iOS app");
            });
        }
    });
    console.log("Socket server attached");
};

function LogSockets(msg) {
    if (!config.debug) {
        return;
    }
    var count = 0;
    var ids = [];
    var users = [];
    for (var k in sockets) {
        ids.push(k);
        users.push(sockets[k].User);
        count++;
    }
    console.log(utils.dateFormat(Date.now(), "DD/MM/YYYY HH:mm:ss"));
    console.log(msg + " | Socket count : " + count + " [ " + ids + " ] ");
    console.log('Users : ' + JSON.stringify(users));
    console.log('');
}
