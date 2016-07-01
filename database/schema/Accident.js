var mongoose = require('mongoose');
var AccidentSchema = mongoose.Schema({
    Description: {
        type: String,
        required: true
    },
    ImageFile: {
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
    IsHandled: {
        type: Boolean,
        default: false
    },
    ReporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    ReporterPhone: {
      type: String  
    },
    HandlerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    id: true
});

// Ensure virtual fields are serialised.
AccidentSchema.set('toJSON', {
    virtuals: true
}); 
AccidentSchema.options.toJSON.transform = function(doc, ret, options) {
    //delete ret.id;
    delete ret._id;
    delete ret.__v;
};
var Accident = mongoose.model('Accident', AccidentSchema);
module.exports = Accident;