var mongoose = require('mongoose');
var CrtPlaceSchema = mongoose.Schema({
    Title: {
        type: String,
    },
    Address: {
        StreetAddress: {
            type: String,
        },
        City: {
            type: String,
        },
        Country: {
            type: String,
            default: 'Tunisia'
        },
        ZipCode: {
            type: Number,
        }
    },
    Location: {
        Longitude: {
            type: Number
        },
        Latitude: {
            type: Number
        }
    },
    PhoneNumber: {
      type: String  
    }
}, {
    id: true
});

// Ensure virtual fields are serialised.
CrtPlaceSchema.set('toJSON', {
    virtuals: true
}); 
CrtPlaceSchema.options.toJSON.transform = function(doc, ret, options) {
    //delete ret.id;
    delete ret._id;
    delete ret.__v;
};
var CrtPlace = mongoose.model('CrtPlace', CrtPlaceSchema);
module.exports = CrtPlace;