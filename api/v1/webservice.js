var https = require('https');
var fs = require('fs');
var path = require('path');
var jwt = require('jsonwebtoken');
var express = require('express');
var multer = require('multer');
var upload = multer().single('ImageFile');
var router = express.Router();
var database = require('../../database/DatabaseHandler');
var socket = require('../../socket');
var utils = require('../../utils');
var config = require('../../config');

module.exports.Attach = function(app) {
    //check public images folders
    var publicFolders = ['images/users/', 'images/accidents/', 'images/messages/'];
    publicFolders.forEach(function(folder) {
        var fullPath = path.resolve(__dirname, '../../client/' + folder);
        fs.exists(fullPath, function(exists) {
            if (!exists) {
                fs.mkdir(fullPath);
            }
        });
    });

    if (config.debug) {
        router.get('/debug/dummy', DummyFunc);
        router.get('/debug/users', GetAllUsersDebug);
        router.get('/debug/accidents/clear', ClearAllAccidentsDebug);
        router.get('/debug/accidents', GetAllAccidentsDebug);
        router.get('/debug/logs', GetAllLogsDebug);
        router.get('/debug/messages', GetAllMessagesDebug);
        router.get('/debug/blacklistedtokens', GetAllBlacklistedTokensDebug);
        router.get('/debug/setadminormember/:id', SetAdminOrMemberDebug);
        router.get('/debug/:model/:operation', ListClearDebug);
        router.get('/debug/user/delete/:id', DeleteUser);
    }

    router.get('/ping', Ping);

    router.post('/user/add', AddUser);

    router.post('/authenticate', Authenticate);

    router.get('/facebookauth', FacebookAuth);

    router.post('/sms', PostSMS);

    router.get('/crtplaces', GetCrtPlaces);

    router.use(VerifyToken); //Middleware

    router.get('/logout', Logout);

    router.get('/users', GetUsers);

    router.post('/user/edit', EditUser);

    router.post('/user/submitimage', SubmitUserImage);

    router.get('/user/requestmembership', RequestMembership);

    router.get('/user/approvemember/:id', ApproveMember);

    router.get('/user/requestadminship', RequestAdminship);

    router.get('/user/approveadmin/:id', ApproveAdmin);

    router.get('/user/:id', GetUserByID);

    router.get('/accidents', GetAccidents);

    router.post('/accident/report', ReportAccident);

    router.get('/accident/handle/:id', HandleAccident);

    router.get('/messages', GetMessages);

    router.post('/message/send', SendMessage);

    router.post('/crtplace/add', AddCrtPlace);

    router.post('/crtplace/edit/:id', EditCrtPlace);

    router.delete('/crtplace/delete/:id', DeleteCrtPlace);

    app.use('/api/v1', router);
    console.log('Web service v1 started');
};

function Ping(req, res) {
    return res.status(200).json({
        success: true,
        message: "pong"
    });
}

function AddUser(req, res) {
    if (!req.body.FirstName || !req.body.LastName || (!req.body.Email && !req.body.Username) || !req.body.BirthDate || !req.body.Password) {
        return res.status(412).json({
            success: false,
            message: 'Could not create user: missing information.'
        });
    }
    var user = new database.User();
    user.FirstName = req.body.FirstName;
    user.LastName = req.body.LastName;
    if (req.body.Email) {
        user.Email = req.body.Email.toLowerCase();
    }
    user.BirthDate = utils.stringToDate(req.body.BirthDate, "DD/MM/YYYY", "/");
    user.Password = req.body.Password;
    if (req.body.NationalId) {
        user.NationalId = req.body.NationalId;
    }
    if (req.body.PhoneNumber) {
        user.PhoneNumber = req.body.PhoneNumber;
    }
    if (req.body.Username) {
        user.Username = req.body.Username;
    }
    if (req.body.BloodType) {
        user.BloodType = req.body.BloodType;
    }
    user.save(function(err) {
        if (err) {
            console.log(err);
            if (err.code == 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'Could not create user: user already exists.'
                });
            }
            else {
                return res.status(500).json({
                    success: false,
                    message: 'Could not create user: database error.'
                });
            }
        }
        else {
            return res.status(200).json({
                success: true,
                message: 'User Added.',
                UserID: user.id
            });
        }
    });
}

function Authenticate(req, res) {
    if ((!req.body.Email && !req.body.Username) || !req.body.Password) {
        return res.status(412).json({
            success: false,
            message: 'Authentication failed. Missing Email/Username/Password.'
        });
    }
    if (req.body.Email) {
        req.body.Email = req.body.Email.toLowerCase();
    }

    database.User.findOne({
        $or: [{
            Username: req.body.Email || req.body.Username
        }, {
            Email: req.body.Email || req.body.Username
        }]
    }, function(err, user) {
        if (err || !user) {
            res.status(412).json({
                success: false,
                message: 'Authentication failed. Wrong User/Password.'
            });
        }
        else if (user) {

            // check if password matches
            if (user.Password != req.body.Password) { //  && user.FacebookId != req.body.FacebookId <== this makes any password correct.
                res.status(412).json({
                    success: false,
                    message: 'Authentication failed. Wrong User/Password.'
                });
            }
            else {

                // if user is found and password is right
                // create a token
                var token = jwt.sign({
                    UserID: user.id,
                    IsMember: user.IsMember,
                    IsAdmin: user.IsAdmin
                }, config.tokenSecret, {
                    expiresIn: config.tokenExpirationTime
                });

                // return the information including token as JSON
                res.status(200).json({
                    success: true,
                    token: token,
                    UserID: user.id
                });
            }

        }
    });
}

function FacebookAuth(req, res) {
    var access_token = req.body.access_token || req.query.access_token || req.headers['access_token'];
    if (!access_token) {
        return res.status(412).json({
            success: false,
            message: 'Missing facebook access_token.'
        });
    }

    function httpsGet(url, callback) {
        https.get(url, function(res) {
            var output = '';
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                output += chunk;
            });
            res.on('end', function() {
                var ret = JSON.parse(output);
                if (ret.error) {
                    callback('Error graph.facebook.com api.');
                }
                else {
                    callback(null, ret);
                }
            });
        }).on('error', function(err) {
            console.log(err);
            callback('Error graph.facebook.com api.');
        });
    }
    httpsGet('https://graph.facebook.com/me?' +
        'fields=id,email,picture.width(320).height(320),birthday,first_name,last_name&access_token=' + access_token,
        function(err, user) {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: err
                });
            }
            var User = {
                FirstName: user.first_name,
                LastName: user.last_name,
                FacebookId: user.id
            };
            if (user.birthday) {
                User.BirthDate = user.birthday;
            }
            if (user.email) {
                User.Email = user.email;
            }
            if (user.picture.data.url) {
                User.ImageFile = user.picture.data.url;
            }
            database.User.findOneAndUpdate({
                $or: [{
                    FacebookId: User.FacebookId
                }, {
                    Email: User.Email
                }]
            }, User, {
                upsert: true,
                'new': true
            }, function(err, doc) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Database error'
                    });
                }
                var token = jwt.sign({
                    UserID: doc.id,
                    IsMember: doc.IsMember,
                    IsAdmin: doc.IsAdmin
                }, config.tokenSecret, {
                    expiresIn: config.tokenExpirationTime
                });

                // return the information including token as JSON
                return res.status(200).json({
                    success: true,
                    token: token,
                    UserID: doc.id
                });
            });
        });
}
    /*
    Number : +18704556288                                                      
    ACCOUNT SID : ACc9a541b00d85f05cc0469d52c83dac00
    AUTH TOKEN : c46d0096fc7fc77b6c1980d7131bebf5
    Messaging Service SID : MG3e591eeaf197c02410ca96855e16fb2e
    Post Url : https://crt-server-ibicha.c9users.io/api/v1/sms
    Doc : https://www.twilio.com/docs/api/twiml/sms/twilio_request
      
    console.log(req.body.MessageSid);
    console.log(req.body.AccountSid);
    console.log(req.body.MessagingServiceSid);
    console.log(req.body.From);
    console.log(req.body.To);
    console.log(req.body.Body);
*/
function PostSMS(req, res) {
    console.log("SMS POST!!!");
    console.log(req.body.Body);

    var fixedBody = req.body.Body;
    if (!fixedBody.startsWith("{")) {
        fixedBody = "{" + fixedBody;
    }
    if (!fixedBody.endsWith("}")) {
        fixedBody = fixedBody + "}";
    }

    var smsBody = {};
    try {
        smsBody = JSON.parse(fixedBody);
    }
    catch (e) {
        console.log("bad json");
        console.log(e);
        return res.status(400).json({
            success: false,
            message: 'Could not report sms accident: bad json.'
        });
    }
    if (!smsBody.d || !smsBody.x || !smsBody.y || !smsBody.t) {
        console.log("missing information");
        return res.status(412).json({
            success: false,
            message: 'Could not report sms accident: missing information.'
        });
    }
    var smsAccident = new database.Accident();
    smsAccident.Description = smsBody.d;
    smsAccident.Location = {
        Latitude: smsBody.x,
        Longitude: smsBody.y,
        Timestamp: smsBody.t
    };
    smsAccident.ReporterPhone = req.body.From;
    smsAccident.save(function(err) {
        if (err) {
            console.log("Database error");
            console.log(err);
            res.status(500).json({
                success: false,
                message: 'Could not report sms accident: Database error.'
            });
        }
        else {
            if (socket.ReportAccident) {
                socket.ReportAccident({
                    id: smsAccident.id,
                    Description: smsAccident.Description,
                    Location: smsAccident.Location,
                });
            }
            res.status(200).json({
                success: true,
                message: 'Sms accident reported.',
            });
        }
    });
}

function GetCrtPlaces(req, res) {
    database.CrtPlace.find({}, function(err, crtplaces) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                crtplaces: crtplaces
            });
        }
    });
}

function VerifyToken(req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.access_token || req.query.access_token || req.headers['access_token'];

    // decode token
    if (token) {
        TestToken(token, function(err, decoded) {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Failed to authenticate token.'
                });
            }
            else {
                req.decoded = decoded;
                req.token = token;
                next();
            }
        });
    }
    else {
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });

    }
}

function Logout(req, res) {
    //Store access token in BlacklistedToken.
    var blackListedToken = new database.BlacklistedToken();
    blackListedToken.Token = req.token;
    blackListedToken.ExpirationDate = req.decoded.exp * 1000;
    blackListedToken.save(function(err) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Could not logout user.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'Logged out.',
            });
        }
    });
}

function GetUsers(req, res) {
    var searchPattern = {};
    if (req.decoded.IsAdmin != true) {
        searchPattern._id = req.decoded.UserID;
    }
    database.User.find(searchPattern).select('-Password -__v').exec(function(err, users) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                users: users
            });
        }
    });
}

function EditUser(req, res) {
    var updateVars = {};

    if (req.body.FirstName) {
        updateVars.FirstName = req.body.FirstName;
    }
    if (req.body.LastName) {
        updateVars.LastName = req.body.LastName;
    }
    if (req.body.Email) {
        updateVars.Email = req.body.Email;
    }
    if (req.body.BirthDate) {
        updateVars.BirthDate = utils.stringToDate(req.body.BirthDate, "DD/MM/YYYY", "/");
    }
    if (req.body.Password) {
        updateVars.Password = req.body.Password;
    }
    if (req.body.FacebookId) {
        updateVars.FacebookId = req.body.FacebookId;
    }
    if (req.body.NationalId) {
        updateVars.NationalId = req.body.NationalId;
    }
    if (req.body.PhoneNumber) {
        updateVars.PhoneNumber = req.body.PhoneNumber;
    }
    if (req.body.Username) {
        updateVars.Username = req.body.Username;
    }
    if (req.body.ImageFile) {
        updateVars.ImageFile = req.body.ImageFile;
    }
    if (req.body.BloodType) {
        updateVars.BloodType = req.body.BloodType;
    }

    var count = 0;
    for (var k in updateVars) {
        if (updateVars.hasOwnProperty(k)) {
            count++;
        }
    }

    if (count == 0) {
        return res.status(412).json({
            success: false,
            message: 'Nothing is updated.'
        });
    }
    database.User.findByIdAndUpdate(req.decoded.UserID, {
        $set: updateVars
    }, function(err, user) {
        if (err) {
            if (err.code == 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'Could not edit user: info already exists.'
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            return res.status(200).json({
                success: true,
                message: 'User updated.'
            });
        }
    });
}

function SubmitUserImage(req, res) {

    upload(req, res, function(err) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Image Upload error.'
            });
            return;
        }
        if (!req.file) {
            return res.status(412).json({
                success: false,
                message: 'Missing Image.'
            });
        }
        var ImageFileName = req.decoded.UserID + path.extname(req.file.originalname);
        var ImageFilePath = "../../client/images/users/";
        var absPath = path.resolve(__dirname, ImageFilePath + ImageFileName);

        fs.writeFile(absPath, req.file.buffer, function(err) {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    success: false,
                    message: 'Image Upload error.'
                });
            }
            database.User.findByIdAndUpdate(req.decoded.UserID, {
                $set: {
                    ImageFile: config.hostname + '/images/users/' + ImageFileName
                }
            }, function(err, user) {
                if (err) {
                    res.status(500).json({
                        success: false,
                        message: 'Database error.'
                    });
                }
                else {
                    console.log(req + " " + req.file + " ");
                    res.status(200).json({
                        success: true,
                        message: 'User picture updated.'
                    });
                }
            });
        });

    });
}

function GetUserByID(req, res) {
    if (req.params.id.toLowerCase() == "me") {
        req.params.id = req.decoded.UserID;
    }
    if (req.decoded.IsAdmin == true || req.params.id == req.decoded.UserID) {
        database.User.findById(req.params.id).select('-Password -__v').exec(function(err, user) {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Database error.'
                });
            }
            else {
                res.status(200).json({
                    success: true,
                    user: user
                });
            }
        });
    }
    else {
        res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
}

function RequestMembership(req, res) {
    if (req.decoded.IsMember == true) {
        return res.status(412).json({
            success: false,
            message: 'You are already a member.'
        });
    }
    database.User.findByIdAndUpdate(req.decoded.UserID, {
        $set: {
            IsRequestingMembership: true
        }
    }, function(err, user) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(202).json({
                success: true,
                message: 'Request sent. Waiting for an admin to approve.'
            });
        }
    });
}

function ApproveMember(req, res) {
    if (req.decoded.IsAdmin == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    database.User.findByIdAndUpdate(req.params.id, {
        $set: {
            IsMember: true
        },
        $unset: {
            IsRequestingMembership: ""
        }
    }, function(err, user) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'Member Approved.'
            });
        }
    });
}

function RequestAdminship(req, res) {
    if (req.decoded.IsAdmin == true) {
        return res.status(412).json({
            success: false,
            message: 'You are already an admin.'
        });
    }
    if (req.decoded.IsMember == false) {
        return res.status(412).json({
            success: false,
            message: 'You must be a member first.'
        });
    }
    database.User.findByIdAndUpdate(req.decoded.UserID, {
        $set: {
            IsRequestingAdminship: true
        }
    }, function(err, user) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(202).json({
                success: true,
                message: 'Request sent. Waiting for an admin to approve.'
            });
        }
    });
}

function ApproveAdmin(req, res) {
    if (req.decoded.IsAdmin == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    database.User.findByIdAndUpdate(req.params.id, {
        $set: {
            IsAdmin: true
        },
        $unset: {
            IsRequestingAdminship: ""
        }
    }, function(err, user) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'Admin Approved.'
            });
        }
    });
}

function GetAccidents(req, res) {
    if (req.decoded.IsMember == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    database.Accident.find({
        //IsHandled: false, //only unhandled
        'Location.Timestamp': {
            $gte: (utils.CurrentTimestamp() - (1000 * 60 * 60 * 6)) // only accidents in the last 6 hours 
        }
    }).select('id Description ImageFile Location IsHandled').exec(function(err, accidents) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                accidents: accidents
            });
        }
    });
}

function ReportAccident(req, res) {
console.log(req.body.Location);
console.log(req.body.Description);

    upload(req, res, function(err) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'request error.'
            });
            return;
        }
        if (!req.body.Description || !req.body.Location) {
            return res.status(412).json({
                success: false,
                message: 'Could not report accident: missing information.'
            });
        }

        var accident = new database.Accident();
        accident.Description = req.body.Description;
        try {
            accident.Location = JSON.parse(req.body.Location);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                message: 'Could not report accident: bad json.'
            });
        }
        accident.ReporterId = req.decoded.UserID;
        console.log(accident);

        accident.save(function(err) {
            if (err) {
                console.log(err);
                res.status(500).json({
                    success: false,
                    message: 'Could not report accident: database error.'
                });
            }
            else {
                if (req.file) {
                    var ImageFileName = accident.id + path.extname(req.file.originalname);
                    var ImageFilePath = "../../client/images/accidents/";
                    var absPath = path.resolve(__dirname, ImageFilePath + ImageFileName);

                    accident.ImageFile = config.hostname + '/images/accidents/' + ImageFileName;

                    fs.writeFile(absPath, req.file.buffer, function(err) {
                        if (!err) {
                            accident.save();
                        }

                    });
                }
                res.status(200).json({
                    success: true,
                    message: 'Accident Reported.',
                });
                if (socket.ReportAccident) {
                    socket.ReportAccident({
                        id: accident.id,
                        Description: accident.Description,
                        Location: accident.Location,
                        ImageFile: accident.ImageFile
                    });
                }
            }
        });
    });
}

function HandleAccident(req, res) {
    if (req.decoded.IsMember == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    database.Accident.findByIdAndUpdate(req.params.id, {
        $set: {
            IsHandled: true,
            HandlerId: req.decoded.UserID
        }
    }, function(err, user) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'Accident Handled.'
            });
            if (socket.AccidentHandled) {
                socket.AccidentHandled({
                    id: req.params.id,
                });
            }
        }
    });
}
//TODO: Limit messages before a date.
function GetMessages(req, res) {

    var searchPattern = [{
        Audience: req.decoded.UserID,
    }, {
        Audience: "Users",
    }];
    if (req.decoded.IsMember) {
        searchPattern.push({
            Audience: "Members"
        });
    }
    if (req.decoded.IsAdmin) {
        searchPattern.push({
            Audience: "Admins"
        });
    }
    database.Message.find({
        $or: searchPattern
    }).select().sort({
        SubmitDate: -1
    }).limit(100).exec(function(err, messages) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                messages: messages
            });
        }
    });
}

function SendMessage(req, res) {
    upload(req, res, function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'request error.'
            });
        }
        if (!req.body.Title || !req.body.Audience) {
            return res.status(412).json({
                success: false,
                message: 'Could not send message: missing information.'
            });
        }
        var audience;
        console.log(req.body.Audience);
        try {
            audience = JSON.parse(req.body.Audience);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                message: 'Could not send message: bad json (Audience).'
            });
        }
        audience = [].concat(audience);
        var accessDenied = false;
        audience.forEach(function(item) {
            if (!(req.decoded.IsAdmin == true || item == 'Admins')) {
                accessDenied = true;
            }
        });
        if (accessDenied) {
            return res.status(401).json({
                success: false,
                message: 'Could not send message: access denied.'
            });
        }
        var message = new database.Message();
        message.Title = req.body.Title;
        message.SubmitDate = new Date();
        message.SenderId = req.decoded.UserID;
        message.Audience = audience;

        if (req.body.Description) {
            message.Description = req.body.Description;
        }

        if (req.body.Location) {
            try {
                message.Location = JSON.parse(req.body.Location);
            }
            catch (e) {
                return res.status(400).json({
                    success: false,
                    message: 'Could not send message: bad json (Location).'
                });
            }
        }
        if (req.body.StartDate) {
            message.StartDate = utils.stringToDate(req.body.StartDate, "DD/MM/YYYY", "/");
        }
        if (req.body.EndDate) {
            message.EndDate = utils.stringToDate(req.body.EndDate, "DD/MM/YYYY", "/");
        }
        message.save(function(err) {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    success: false,
                    message: 'Could not send message: database error.'
                });
            }
            else {
                if (req.file) {
                    var ImageFileName = message.id + path.extname(req.file.originalname);
                    var ImageFilePath = "../../client/images/messages/";
                    var absPath = path.resolve(__dirname, ImageFilePath + ImageFileName);

                    message.ImageFile = config.hostname + '/images/messages/' + ImageFileName;

                    fs.writeFile(absPath, req.file.buffer, function(err) {
                        if (!err) {
                            message.save();
                        }
                    });
                }
                res.status(200).json({
                    success: true,
                    message: 'Message Sent.',
                });
                var mess = { //rebuild object
                    id: message.id,
                    Title: message.Title,
                    SubmitDate: message.SubmitDate,
                    SenderId: message.SenderId,
                    Audience: message.Audience
                };
                if (message.ImageFile) {
                    mess.ImageFile = message.ImageFile;
                }
                if (message.Description) {
                    mess.Description = message.Description;
                }
                if (message.Location) {
                    mess.Location = message.Location;
                }
                if (message.StartDate) {
                    mess.StartDate = message.StartDate;
                }
                if (message.EndDate) {
                    mess.EndDate = message.EndDate;
                }
                if (socket.SendMessage) {
                    socket.SendMessage(mess);
                }
            }
        });
    });
}

function AddCrtPlace(req, res) {
    if (req.decoded.IsAdmin == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    if (!req.body.Location) {
        return res.status(412).json({
            success: false,
            message: 'Could not add CrtPlace: missing information.'
        });
    }
    var crtplace = new database.CrtPlace();
    crtplace.Location = req.body.Location;

    if (req.body.Title) {
        crtplace.Title = req.body.Title;
    }
    if (req.body.Address) {
        crtplace.Address = req.body.Address;
    }
    if (req.body.PhoneNumber) {
        crtplace.PhoneNumber = req.body.PhoneNumber;
    }
    crtplace.save(function(err) {
        if (err) {
            console.log(err);
            res.status(500).json({
                success: false,
                message: 'Could not add CrtPlace: database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'CrtPlace Added.'
            });
        }
    });
}

function EditCrtPlace(req, res) {
    if (req.decoded.IsAdmin == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    var updateVars = {};

    if (req.body.Title) {
        updateVars.Title = req.body.Title;
    }
    if (req.body.Address) {
        updateVars.Address = req.body.Address;
    }
    if (req.body.Location) {
        updateVars.Location = req.body.Location;
    }
    if (req.body.PhoneNumber) {
        updateVars.PhoneNumber = req.body.PhoneNumber;
    }

    var count = 0;
    for (var k in updateVars) {
        if (updateVars.hasOwnProperty(k)) {
            count++;
        }
    }
    if (count == 0) {
        return res.status(412).json({
            success: false,
            message: 'Nothing is updated.'
        });
    }
    database.CrtPlace.findByIdAndUpdate(req.params.id, {
        $set: updateVars
    }, function(err, crtplace) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else if (crtplace) {
            res.status(200).json({
                success: true,
                message: 'CrtPlace updated.'
            });
        }
        else {
            return res.status(404).json({
                success: false,
                message: 'Nothing is updated.'
            });
        }
    });
}

function DeleteCrtPlace(req, res) {
    if (req.decoded.IsAdmin == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    database.CrtPlace.findByIdAndRemove(req.params.id, function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            return res.status(200).json({
                success: true,
                message: 'CrtPlace removed.'
            });
        }
    });
}

function TestToken(token, callback) {
    jwt.verify(token, config.tokenSecret, function(err, decoded) {
        if (err) {
            callback(err, null);
        }
        else {
            database.BlacklistedToken.findOne({
                Token: token
            }, function(err, tokens) {
                if (err) {
                    callback(err, null);
                }
                else if (tokens) {
                    callback(new Error('Token blaclisted.'), null);
                }
                else {
                    callback(err, decoded);
                }
            });
        }
    });
}



function GetAllUsersDebug(req, res) {
    database.User.find({}, function(err, users) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.' + err
            });
        }
        else {
            res.status(200).json({
                success: true,
                users: users
            });
        }
    });
}

function ClearAllAccidentsDebug(req, res) {

    database.Accident.remove({}, function(err) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.' + err
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'All accidents removed.'
            });
        }
    });
}

function GetAllAccidentsDebug(req, res) {

    database.Accident.find({}, function(err, accidents) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.' + err
            });
        }
        else {
            res.status(200).json({
                success: true,
                accidents: accidents
            });
        }
    });
}

function GetAllLogsDebug(req, res) {

    database.Log.find({}, function(err, logs) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.' + err
            });
        }
        else {
            res.status(200).json({
                success: true,
                logs: logs
            });
        }
    });
}

function GetAllMessagesDebug(req, res) {

    database.Message.find({}, function(err, messages) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.' + err
            });
        }
        else {
            res.status(200).json({
                success: true,
                messages: messages
            });
        }
    });
}

function GetAllBlacklistedTokensDebug(req, res) {

    database.BlacklistedToken.find({}, function(err, blacklistedtokens) {
        if (err) {
            res.status(500).json({
                success: false,
                message: 'Database error.' + err
            });
        }
        else {
            res.status(200).json({
                success: true,
                blacklistedtokens: blacklistedtokens
            });
        }
    });
}

function SetAdminOrMemberDebug(req, res) {
    var updateVars = {};

    if (req.query.IsAdmin) {
        updateVars.IsAdmin = req.query.IsAdmin;
    }
    if (req.query.IsMember) {
        updateVars.IsMember = req.query.IsMember;
    }

    database.User.findByIdAndUpdate(req.params.id, {
        $set: updateVars
    }, function(err, user) {
        if (err || !user) {
            res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'User updated.'
            });
        }
    });
}

function ListClearDebug(req, res) {
    var model = database[req.params.model];
    if (!model) {
        return res.status(406).json({
            success: false,
            message: 'The model ' + req.params.model + ' is not supported.'
        });
    }
    var operation = req.params.operation;
    if (['List', 'Clear'].indexOf(operation) == -1) {
        return res.status(406).json({
            success: false,
            message: 'The operation ' + operation + ' is not supported.'
        });
    }
    switch (operation) {
        case 'List':
            model.find({}, function(err, objects) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Database error.' + err
                    });
                }
                else {
                    return res.status(200).json({
                        success: true,
                        data: objects
                    });
                }
            });
            break;
        case 'Clear':
            model.remove({}, function(err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Database error.' + err
                    });
                }
                else {
                    return res.status(200).json({
                        success: true,
                        message: 'All ' + req.params.model + ' removed.'
                    });
                }
            });
            break;

        default:
            return res.status(501).json({
                success: false,
                message: 'well, this is weird.'
            });
    }
}

function DeleteUser(req, res) {
    if (req.decoded.IsAdmin == false) {
        return res.status(401).json({
            success: false,
            message: 'Access denied.'
        });
    }
    database.User.findByIdAndRemove(req.params.id, function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error.'
            });
        }
        else {
            return res.status(200).json({
                success: true,
                message: 'User removed.'
            });
        }
    });
}

function DummyFunc(req, res) {
    return res.status(200).json({
        success: true
    });
}

module.exports.TestToken = TestToken;