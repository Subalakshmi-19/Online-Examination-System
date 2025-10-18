const express = require('express');
const User = require('../models/User');
const ExamResult = require('../models/ExamResult');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Get all users (Admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        
        // Get exam counts for each user
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const examCount = await ExamResult.countDocuments({ user: user._id });
                return {
                    ...user.toObject(),
                    examsTaken: examCount
                };
            })
        );

        res.json({
            success: true,
            users: usersWithStats
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create new user (Admin only)
router.post('/', adminAuth, async (req, res) => {
    try {
        const { name, email, password, role, department } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = new User({
            name,
            email,
            password,
            role: role || 'student',
            department: role === 'student' ? (department || 'General Studies') : undefined
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                studentId: user.studentId,
                department: user.department,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating user'
        });
    }
});

// Get user by ID
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Update user
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { name, email, department, isActive } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, department, isActive },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating user'
        });
    }
});

// Delete user
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Also delete user's exam results
        await ExamResult.deleteMany({ user: req.params.id });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting user'
        });
    }
});

// Get user statistics
router.get('/:id/stats', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Check if user is accessing their own stats or is admin
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const examResults = await ExamResult.find({ user: userId })
            .populate('exam', 'name totalMarks')
            .sort({ createdAt: -1 });

        const totalExams = examResults.length;
        const totalScore = examResults.reduce((sum, result) => sum + result.score, 0);
        const totalPossible = examResults.reduce((sum, result) => sum + result.totalMarks, 0);
        const averageScore = totalExams > 0 ? (totalScore / totalExams) : 0;
        const averagePercentage = totalExams > 0 ? (totalScore / totalPossible) * 100 : 0;

        res.json({
            success: true,
            stats: {
                totalExams,
                averageScore: Math.round(averageScore * 100) / 100,
                averagePercentage: Math.round(averagePercentage * 100) / 100,
                totalScore,
                examHistory: examResults
            }
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;