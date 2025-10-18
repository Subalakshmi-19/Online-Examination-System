const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    options: [{
        type: String,
        required: true
    }],
    correct: {
        type: Number,
        required: true,
        min: 0
    },
    marks: {
        type: Number,
        default: 1
    }
});

const examSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    duration: {
        type: Number, // in minutes
        required: true
    },
    questions: [questionSchema],
    totalQuestions: {
        type: Number,
        required: true
    },
    totalMarks: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'completed', 'cancelled'],
        default: 'draft'
    },
    enrolled: {
        type: Number,
        default: 0
    },
    instructions: {
        type: String,
        default: 'Read all questions carefully before answering.'
    },
    passingMarks: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Virtual for exam ID
examSchema.virtual('examId').get(function() {
    return `EXM${this._id.toString().slice(-7).toUpperCase()}`;
});

module.exports = mongoose.model('Exam', examSchema);