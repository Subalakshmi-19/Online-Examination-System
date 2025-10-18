const express = require('express');
const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Submit exam results
router.post('/', auth, async (req, res) => {
    try {
        const { examId, answers, timeTaken } = req.body;

        // Get exam with correct answers
        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        // Check if user has already submitted
        const existingResult = await ExamResult.findOne({
            user: req.user._id,
            exam: examId
        });

        if (existingResult) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted this exam'
            });
        }

        // Calculate score
        let score = 0;
        const detailedAnswers = answers.map((answer, index) => {
            const question = exam.questions[index];
            const isCorrect = answer.selectedOption === question.correct;
            const marksObtained = isCorrect ? (question.marks || 1) : 0;
            
            score += marksObtained;

            return {
                questionIndex: index,
                selectedOption: answer.selectedOption,
                isCorrect,
                marksObtained
            };
        });

        // Create exam result
        const examResult = new ExamResult({
            user: req.user._id,
            exam: examId,
            score,
            totalMarks: exam.totalMarks,
            percentage: (score / exam.totalMarks) * 100,
            answers: detailedAnswers,
            timeTaken,
            status: 'completed',
            submittedAt: new Date()
        });

        await examResult.save();

        // Update exam enrollment count
        exam.enrolled += 1;
        await exam.save();

        res.status(201).json({
            success: true,
            message: 'Exam submitted successfully',
            result: {
                score,
                totalMarks: exam.totalMarks,
                percentage: examResult.percentage,
                timeTaken
            }
        });
    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while submitting exam'
        });
    }
});

// Get user's exam results
router.get('/my-results', auth, async (req, res) => {
    try {
        const results = await ExamResult.find({ user: req.user._id })
            .populate('exam', 'name description totalMarks duration')
            .sort({ submittedAt: -1 });

        res.json({
            success: true,
            results: results.map(result => ({
                id: result._id,
                exam: result.exam,
                score: result.score,
                totalMarks: result.totalMarks,
                percentage: result.percentage,
                timeTaken: result.timeTaken,
                submittedAt: result.submittedAt,
                status: result.status
            }))
        });
    } catch (error) {
        console.error('Get my results error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get all results (Admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        const results = await ExamResult.find()
            .populate('user', 'name email studentId department')
            .populate('exam', 'name totalMarks duration')
            .sort({ submittedAt: -1 });

        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Get all results error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get result by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await ExamResult.findById(req.params.id)
            .populate('user', 'name email studentId department')
            .populate('exam', 'name description totalMarks duration questions');

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Result not found'
            });
        }

        // Check if user is authorized to view this result
        if (req.user.role !== 'admin' && result.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Get result error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get exam statistics
router.get('/exam/:examId/stats', adminAuth, async (req, res) => {
    try {
        const { examId } = req.params;

        const results = await ExamResult.find({ exam: examId })
            .populate('user', 'name studentId');

        const totalParticipants = results.length;
        const averageScore = totalParticipants > 0 ? 
            results.reduce((sum, result) => sum + result.score, 0) / totalParticipants : 0;
        const averagePercentage = totalParticipants > 0 ?
            results.reduce((sum, result) => sum + result.percentage, 0) / totalParticipants : 0;

        // Calculate score distribution
        const scoreRanges = {
            excellent: results.filter(r => r.percentage >= 90).length,
            good: results.filter(r => r.percentage >= 70 && r.percentage < 90).length,
            average: results.filter(r => r.percentage >= 50 && r.percentage < 70).length,
            poor: results.filter(r => r.percentage < 50).length
        };

        res.json({
            success: true,
            stats: {
                totalParticipants,
                averageScore: Math.round(averageScore * 100) / 100,
                averagePercentage: Math.round(averagePercentage * 100) / 100,
                scoreRanges,
                results: results.map(r => ({
                    user: r.user,
                    score: r.score,
                    percentage: r.percentage,
                    timeTaken: r.timeTaken,
                    submittedAt: r.submittedAt
                }))
            }
        });
    } catch (error) {
        console.error('Get exam stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;