const express = require('express');
const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Get all exams (with optional filtering)
router.get('/', auth, async (req, res) => {
    try {
        const { status, search } = req.query;
        let filter = {};

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const exams = await Exam.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        // For students, check if they've already taken the exam
        if (req.user.role === 'student') {
            const examsWithStatus = await Promise.all(
                exams.map(async (exam) => {
                    const existingResult = await ExamResult.findOne({
                        user: req.user._id,
                        exam: exam._id
                    });

                    return {
                        ...exam.toObject(),
                        examId: exam.examId,
                        userStatus: existingResult ? 'completed' : 'available'
                    };
                })
            );

            return res.json({
                success: true,
                exams: examsWithStatus
            });
        }

        // For admin/teachers, include exam ID
        const examsWithId = exams.map(exam => ({
            ...exam.toObject(),
            examId: exam.examId
        }));

        res.json({
            success: true,
            exams: examsWithId
        });
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get exam by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('createdBy', 'name email');
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        // For students, don't send correct answers
        if (req.user.role === 'student') {
            const examWithoutAnswers = {
                ...exam.toObject(),
                examId: exam.examId,
                questions: exam.questions.map(q => ({
                    text: q.text,
                    options: q.options,
                    marks: q.marks
                }))
            };
            return res.json({
                success: true,
                exam: examWithoutAnswers
            });
        }

        res.json({
            success: true,
            exam: {
                ...exam.toObject(),
                examId: exam.examId
            }
        });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create new exam (Admin only)
router.post('/', adminAuth, async (req, res) => {
    try {
        const { name, description, duration, questions, instructions, passingMarks } = req.body;

        // Calculate total marks and questions
        const totalQuestions = questions.length;
        const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

        const exam = new Exam({
            name,
            description,
            duration,
            questions,
            totalQuestions,
            totalMarks,
            instructions,
            passingMarks,
            createdBy: req.user._id
        });

        await exam.save();

        res.status(201).json({
            success: true,
            message: 'Exam created successfully',
            exam: {
                ...exam.toObject(),
                examId: exam.examId
            }
        });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating exam'
        });
    }
});

// Update exam
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { name, description, duration, questions, status, instructions, passingMarks } = req.body;

        // Recalculate totals if questions are updated
        let updateData = { name, description, duration, status, instructions, passingMarks };
        
        if (questions) {
            updateData.questions = questions;
            updateData.totalQuestions = questions.length;
            updateData.totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
        }

        const exam = await Exam.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        res.json({
            success: true,
            message: 'Exam updated successfully',
            exam: {
                ...exam.toObject(),
                examId: exam.examId
            }
        });
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating exam'
        });
    }
});

// Delete exam
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const exam = await Exam.findByIdAndDelete(req.params.id);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        // Also delete all results for this exam
        await ExamResult.deleteMany({ exam: req.params.id });

        res.json({
            success: true,
            message: 'Exam deleted successfully'
        });
    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting exam'
        });
    }
});

// Get exam questions for taking exam
router.get('/:id/questions', auth, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        // Check if exam is active
        if (exam.status !== 'active' && req.user.role === 'student') {
            return res.status(400).json({
                success: false,
                message: 'This exam is not currently available'
            });
        }

        // Check if user has already taken this exam
        const existingResult = await ExamResult.findOne({
            user: req.user._id,
            exam: exam._id
        });

        if (existingResult && req.user.role === 'student') {
            return res.status(400).json({
                success: false,
                message: 'You have already taken this exam'
            });
        }

        // Return questions without correct answers
        const questionsWithoutAnswers = exam.questions.map(q => ({
            text: q.text,
            options: q.options,
            marks: q.marks
        }));

        res.json({
            success: true,
            exam: {
                _id: exam._id,
                name: exam.name,
                description: exam.description,
                duration: exam.duration,
                totalQuestions: exam.totalQuestions,
                totalMarks: exam.totalMarks,
                instructions: exam.instructions,
                questions: questionsWithoutAnswers
            }
        });
    } catch (error) {
        console.error('Get exam questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;