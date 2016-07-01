var config = {};

config.debug = true;

config.tokenSecret = 'SecretTokenPasswordHere';

config.tokenExpirationTime = 60 * 60 * 12 * (2 * 30); //in seconds

config.database = 'mongodb://localhost/crtDB';

config.hostname = 'https://crt-server-ibicha.c9users.io';  

config.membersRange = 1000000; //meters

config.cleanUnusedImagesOnStartup = false;

module.exports = config;