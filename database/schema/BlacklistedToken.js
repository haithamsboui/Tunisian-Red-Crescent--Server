var mongoose = require('mongoose');
var BlacklistedTokenSchema = mongoose.Schema({
    Token: {
        type: String,
        required: true
    },
    ExpirationDate: {
        type: Date
    }
});
var BlacklistedToken = mongoose.model('BlacklistedToken', BlacklistedTokenSchema);
module.exports = BlacklistedToken;