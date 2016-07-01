var mongoose = require('mongoose');
var MessageSchema = mongoose.Schema({
    Title: {
        type: String,
        required: true
    },
    SubmitDate: {
        type: Date,
        required: true
    },
    SenderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required:true
    },
    Audience: {
        type: mongoose.Schema.Types,
        required:true
    },
    ImageFile: {
        type: String
    },
    Description: {
        type: String
    },
    Location: {
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
    },
    StartDate: {
        type: Date
    },
    EndDate: {
        type: Date
    }
}, {
    id: true
});

// Ensure virtual fields are serialised.
MessageSchema.set('toJSON', {
    virtuals: true
});
MessageSchema.options.toJSON.transform = function(doc, ret, options) {
    //delete ret.id;
    delete ret._id;
    delete ret.__v;
};
var Message = mongoose.model('Message', MessageSchema);
module.exports = Message;