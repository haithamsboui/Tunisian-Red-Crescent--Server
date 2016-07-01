var mongoose = require('mongoose');
var utils = require('../../utils');
// Missing Level,medical Speciality 

var UserSchema = mongoose.Schema({
    //Required
    FirstName: {
        type: String,
        required: true
    },
    LastName: {
        type: String,
        required: true
    },
    //Optional
    Email: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    BirthDate: {
        type: Date,
    },
    NationalId: {
        type: String,
        unique: true,
        sparse: true
    },
    PhoneNumber: {
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
        },
    },
    Password: {
        type: String,
    },
    FacebookId: {
        type: String,
        unique: true,
        sparse: true
    },
    Username: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    ImageFile: {
        type: String,
    }, //cache image to local storage
    IsMember: {
        type: Boolean,
        default: false
    },
    IsRequestingMembership: {
        type: Boolean,
    },
    IsAdmin: {
        type: Boolean,
        default: false
    },
    IsRequestingAdminship: {
        type: Boolean,
    },
    BloodType: {
        type: String
    },
    LastRecoredPosition: {
        Longitude: {
            type: Number
        },
        Latitude: {
            type: Number
        },
        Accuracy: {
            type: Number
        },
        Timestamp: {
            type: Number,
        }
    }
}, {
    id: true
});

// Ensure virtual fields are serialised.
UserSchema.set('toJSON', {
    virtuals: true
});
UserSchema.options.toJSON.transform = function(doc, ret, options) {
    if (ret.BirthDate) {
        ret.BirthDate = utils.dateFormat(ret.BirthDate, "DD/MM/YYYY");
    }
    //delete ret.id;
    delete ret._id;
    delete ret.__v;
};
var User = mongoose.model('User', UserSchema);
module.exports = User;
 