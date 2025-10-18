const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 0
    },
    totalMarks: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    answers: [{
        questionIndex: Number,
        selectedOption: Number,
        isCorrect: Boolean,
        marksObtained: Number
    }],
    timeTaken: {
        type: Number, // in seconds
        default: 0
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed', 'submitted', 'timeout'],
        default: 'completed'
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    submittedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Ensure one result per user per exam
examResultSchema.index({ user: 1, exam: 1 }, { unique: true });

// Calculate percentage before saving
examResultSchema.pre('save', function(next) {
    this.percentage = (this.score / this.totalMarks) * 100;
    next();
});

module.exports = mongoose.model('ExamResult', examResultSchema);