var mongoose = require('mongoose');
var LogSchema = mongoose.Schema({
    EventType: { type: String, required:true},
    EventDate: { type: Date,required:true},
    data:{}
});
var Log = mongoose.model('Log', LogSchema);
module.exports = Log;