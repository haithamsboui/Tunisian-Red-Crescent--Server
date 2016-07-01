/*TODO:
 *Create Admin Panel Interface
 * More validation on database values (password 8chars etc..) move date formating to schema
 * Messages StartDate and EndDate should contain date and time (currently only date)
    => Update : momentjs imported 
 * Limit messages before a date.
 * Get Users search criteria for admins (string, requesting admin, requesting member)
 * Password Hashing (sha256 client, bcrypt server)
 * force https (local ssl cert & key)
 * Log : schema of all events happening in the system 
        [
          User signed in,
          User signed out,
          User created,
          User modified,
          User requested becoming member,
          User reported an accident,
          Admin signed in,
          Admin signed out,
          Admin posted message,
          Admin Approuved new member,
          Admin Removed member,
          Admin blocked user,
          Admin added admin,
          Admin removed admin,
        ]
        
 */
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');
var express = require('express');

var webservice = require("./api/v1/webservice");
var socketHandler = require("./socket");
var database = require('./database/DatabaseHandler');
var utils = require('./utils');
var app = express();
var server = http.createServer(app);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(function(error, req, res, next) {
  //Body parser error handling
  console.log(error);
  res.status(error.statusCode || 500).send({
    success: false,
    error: 'Parsing Error'
  });
});

/*Opening database. the rest of the app depends on it.
  In case of an error, nothing else is loaded.*/
database.init(function() {
  //Remove images that are not linked to documents in the database to clear storage
  utils.CleanUnusedImages();
  /*This is where the web service is initialized and linked to our server
   *Requires tha express app instance to manage the routes*/
  webservice.Attach(app);

  //Attaching the socket.io server
  socketHandler.Attach(server);
  //This will serve the front end in the client folder
  app.use(express.static(path.resolve(__dirname, 'client')));

  //Start Server.
  server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function() {
    var addr = server.address();
    console.log("server listening at", addr.address + ":" + addr.port + ' (' + utils.dateFormat(Date.now(),"DD/MM/YYYY HH:mm:ss") + ')');
  });
});
 