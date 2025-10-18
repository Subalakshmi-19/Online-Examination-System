const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['student', 'admin', 'teacher'],
        default: 'student'
    },
    studentId: {
        type: String,
        unique: true,
        sparse: true
    },
    department: {
        type: String,
        default: 'General Studies'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate student ID for new students
userSchema.pre('save', async function(next) {
    if (this.role === 'student' && !this.studentId) {
        const Student = this.constructor;
        const currentYear = new Date().getFullYear();
        
        try {
            const lastStudent = await Student.findOne(
                { role: 'student' },
                { studentId: 1 },
                { sort: { studentId: -1 } }
            );
            
            let nextNumber = 1;
            if (lastStudent && lastStudent.studentId) {
                const lastNumber = parseInt(lastStudent.studentId.slice(7));
                nextNumber = lastNumber + 1;
            }
            
            this.studentId = `STU${currentYear}${nextNumber.toString().padStart(3, '0')}`;
        } catch (error) {
            return next(error);
        }
    }
    next();
});

module.exports = mongoose.model('User', userSchema);