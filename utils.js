var fs = require('fs');
var path = require('path');
var database = require('./database/DatabaseHandler');
var moment = require('moment');
var config = require('./config')

module.exports.FlipCrtPlacesLatLng = function FlipCrtPlacesLatLng() {
    database.CrtPlace.find({}, function(err, crtplaces) {
        if (err) {
            console.log(err);
        }
        else {
            crtplaces.forEach(function(crtplace) {
                var updateVars = {
                    Location: crtplace.Location
                };
                var temp = updateVars.Location.Latitude;
                updateVars.Location.Latitude = updateVars.Location.Longitude;
                updateVars.Location.Longitude = temp;
                
                database.CrtPlace.findByIdAndUpdate(crtplace.id, {
                    $set: updateVars
                }, function(err, crtplace) {
                    if (err) {
                        console.log(err);
                    }
                });
            })
        }
    });


};

module.exports.CleanOldTokens = function CleanOldTokens() {

};

module.exports.CleanUnusedImages = function CleanUnusedImages() {
    if (!config.cleanUnusedImagesOnStartup) return;
    console.log('Cleaning Unused Images...');
    var publicFolders = ['images/users/', 'images/accidents/', 'images/messages/'];
    var models = [database.User, database.Accident, database.Message];
    publicFolders.forEach(function(folder) {
        var fullPath = path.resolve(__dirname, './client/' + folder);
        fs.readdir(fullPath, function(err, files) {
            if (err) {
                console.log(err);
            }
            else {
                files.forEach(function(file) {
                    var id = path.basename(file).replace(path.extname(file), '');
                    models[publicFolders.indexOf(folder)].findById(id, function(err, doc) {
                        if (err) {
                            console.log(err);
                        }
                        else {
                            if (doc) {
                                //doc found. nothing to delete.
                            }
                            else {
                                var filename = path.join(fullPath, file);
                                fs.unlink(filename);
                            }
                        }
                    });
                });
            }

        });
    });
};

//Todo : include hours minutes and seconds in date parsing
module.exports.stringToDate = function stringToDate(_date, _format, _delimiter) {
    return moment(_date, _format).toDate();
    /*var formatLowerCase = _format.toLowerCase();
    var formatItems = formatLowerCase.split(_delimiter);
    var dateItems = _date.split(_delimiter);
    var monthIndex = formatItems.indexOf("mm");
    var dayIndex = formatItems.indexOf("dd");
    var yearIndex = formatItems.indexOf("yyyy");
    var month = parseInt(dateItems[monthIndex]);
    month -= 1;
    var formatedDate = new Date(dateItems[yearIndex], month, dateItems[dayIndex]);
    return formatedDate;*/
};

module.exports.dateFormat = function dateFormat(date, fstr) {
    return moment(date).format(fstr);
    /*utc = utc ? 'getUTC' : 'get';
    return fstr.replace(/%[YmdHMS]/g, function(m) {
        switch (m) {
            case '%Y':
                return date[utc + 'FullYear'](); // no leading zeros required
            case '%m':
                m = 1 + date[utc + 'Month']();
                break;
            case '%d':
                m = date[utc + 'Date']();
                break;
            case '%H':
                m = date[utc + 'Hours']();
                break;
            case '%M':
                m = date[utc + 'Minutes']();
                break;
            case '%S':
                m = date[utc + 'Seconds']();
                break;
            default:
                return m.slice(1); // unknown code, remove %
        }
        // add leading zero if required
        return ('0' + m).slice(-2);
    });*/
};

module.exports.CurrentTimestamp = function CurrentTimestamp() {
    return (new Date()).getTime();
};

module.exports.DistanceBetween = function DistanceBetween(location1, location2) {
    var rad = function(x) {
        return x * Math.PI / 180;
    };
    var R = 6378137; // Earth�s mean radius in meter
    var dLat = rad(location2.Latitude - location1.Latitude);
    var dLong = rad(location2.Longitude - location1.Longitude);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(location1.Latitude)) * Math.cos(rad(location2.Latitude)) *
        Math.sin(dLong / 2) * Math.sin(dLong / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // returns the distance in meter
};