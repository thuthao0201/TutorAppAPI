const Session = require("../models/session.model");
const Class = require("../models/class.model");
const Booking = require("../models/booking.model");
const User = require("../models/user.model");
const Tutor = require("../models/tutor.model");

// Create a new session
const createSession = async (req, res) => {
    try {
        const {classId, bookingId, subject, grade, time, startDate, endDate, requirements} = req.body;

        // Generate a unique room ID
        const roomId = `room_${ Date.now() }_${ Math.random().toString(36).substring(2, 9) }`;

        let tutorId, studentId;

        // If session is created from a class
        if (classId) {
            const classData = await Class.findById(classId);
            if (!classData) {
                return res.status(404).json({
                    status: "fail",
                    message: "Không tìm thấy lớp học",
                });
            }

            tutorId = classData.tutorId;
            studentId = classData.studentId;

            // Create the session
            const session = new Session({
                roomId,
                tutorId,
                studentId,
                subject: subject || classData.subject,
                grade: grade || classData.grade,
                time: time || classData.preferredTime,
                startDate: startDate || classData.startDate,
                endDate: endDate || classData.endDate,
                requirements: requirements || classData.requirements,
            });

            await session.save();

            // Update class with session ID
            classData.sessionId = session._id;
            await classData.save();

            return res.status(201).json({
                status: "success",
                data: session,
            });
        }

        // If session is created from a booking
        if (bookingId) {
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                return res.status(404).json({
                    status: "fail",
                    message: "Không tìm thấy đặt lịch",
                });
            }

            // Create the session
            const session = new Session({
                roomId,
                tutorId: booking.tutorId,
                studentId: booking.studentId,
                subject: subject || booking.subject,
                grade: grade || booking.grade,
                time: time || booking.time,
                startDate: startDate || booking.startDate,
                endDate: endDate || booking.endDate,
                requirements: requirements || booking.requirements,
            });

            await session.save();

            // Update booking with session ID
            booking.sessionId = session._id;
            await booking.save();

            return res.status(201).json({
                status: "success",
                data: session,
            });
        }

        // If session is created directly
        const session = new Session({
            roomId,
            tutorId: req.body.tutorId,
            studentId: req.body.studentId,
            subject,
            grade,
            time,
            startDate,
            endDate,
            requirements,
        });

        await session.save();

        return res.status(201).json({
            status: "success",
            data: session,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi tạo phiên học: " + error.message,
        });
    }
};

// Get all sessions with filtering options
const getSessions = async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user._id;

        let query = {};

        // Filter by date range if provided
        if (req.query.startDate && req.query.endDate) {
            query.startDate = {$gte: new Date(req.query.startDate)};
            query.endDate = {$lte: new Date(req.query.endDate)};
        }

        // Filter by subject if provided
        if (req.query.subject) {
            query.subject = req.query.subject;
        }

        // Filter by status if provided
        if (req.query.status) {
            query.status = req.query.status;
        }

        // For tutors, show only their sessions
        if (role === "tutor") {
            const tutor = await Tutor.findOne({userId});
            if (!tutor) {
                return res.status(404).json({
                    status: "fail",
                    message: "Không tìm thấy thông tin gia sư",
                });
            }
            query.tutorId = tutor._id;
        }
        // For students, show only their sessions
        else if (role === "student") {
            query.studentId = userId;
        }
        // Admin can see all sessions

        const sessions = await Session.find(query)
            .populate({
                path: "tutorId",
                populate: {path: "userId", select: "name email avatar"}
            })
            .populate("studentId", "name email avatar")
            .sort({startDate: -1});

        res.json({
            status: "success",
            results: sessions.length,
            data: sessions,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi lấy danh sách phiên học: " + error.message,
        });
    }
};

// Get specific session by ID
const getSession = async (req, res) => {
    try {
        const session = await Session.findById(req.params.id)
            .populate({
                path: "tutorId",
                populate: {path: "userId", select: "name email avatar phone"}
            })
            .populate("studentId", "name email avatar phone");

        if (!session) {
            return res.status(404).json({
                status: "fail",
                message: "Không tìm thấy phiên học",
            });
        }

        // Check permissions - only related users or admins can view session details
        if (req.user.role !== "admin" &&
            session.studentId._id.toString() !== req.user._id.toString() &&
            session.tutorId.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "fail",
                message: "Bạn không có quyền truy cập thông tin này",
            });
        }

        res.json({
            status: "success",
            data: session,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi lấy thông tin phiên học: " + error.message,
        });
    }
};

// Update session details
const updateSession = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                status: "fail",
                message: "Không tìm thấy phiên học",
            });
        }

        // Only tutors assigned to this session or admins can update
        if (req.user.role !== "admin" &&
            session.tutorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "fail",
                message: "Bạn không có quyền cập nhật phiên học này",
            });
        }

        // Update session with provided data
        const updatedSession = await Session.findByIdAndUpdate(
            sessionId,
            req.body,
            {new: true, runValidators: true}
        );

        res.json({
            status: "success",
            data: updatedSession,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi cập nhật phiên học: " + error.message,
        });
    }
};

// Mark session as completed
const completeSession = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const {notes, rating} = req.body;

        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                status: "fail",
                message: "Không tìm thấy phiên học",
            });
        }

        // Only tutors assigned to this session or admins can mark as complete
        if (req.user.role !== "admin" &&
            session.tutorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "fail",
                message: "Bạn không có quyền thực hiện hành động này",
            });
        }

        session.status = "completed";
        session.completedAt = new Date();
        session.notes = notes;

        // If rating is provided, update it
        if (rating) {
            session.rating = rating;

            // Update tutor's average rating
            const tutor = await Tutor.findById(session.tutorId);
            const newTotalRating = tutor.avgRating * tutor.totalReviews + rating;
            tutor.totalReviews += 1;
            tutor.avgRating = newTotalRating / tutor.totalReviews;
            await tutor.save();
        }

        await session.save();

        res.json({
            status: "success",
            message: "Phiên học đã được đánh dấu là hoàn thành",
            data: session,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi hoàn thành phiên học: " + error.message,
        });
    }
};

// Cancel a session
const cancelSession = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const {reason} = req.body;

        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                status: "fail",
                message: "Không tìm thấy phiên học",
            });
        }

        // Check if session is already completed
        if (session.status === "completed") {
            return res.status(400).json({
                status: "fail",
                message: "Không thể hủy phiên học đã hoàn thành",
            });
        }

        // Any participant (student, tutor) or admin can cancel
        if (req.user.role !== "admin" &&
            session.studentId.toString() !== req.user._id.toString() &&
            session.tutorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "fail",
                message: "Bạn không có quyền hủy phiên học này",
            });
        }

        session.status = "canceled";
        session.canceledAt = new Date();
        session.cancelReason = reason;
        session.canceledBy = req.user._id;

        await session.save();

        res.json({
            status: "success",
            message: "Phiên học đã bị hủy",
            data: session,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi hủy phiên học: " + error.message,
        });
    }
};

// Reschedule a session
const rescheduleSession = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const {newStartDate, newEndDate, newTime, reason} = req.body;

        if (!newStartDate || !newEndDate || !newTime) {
            return res.status(400).json({
                status: "fail",
                message: "Vui lòng cung cấp thời gian mới cho phiên học",
            });
        }

        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                status: "fail",
                message: "Không tìm thấy phiên học",
            });
        }

        // Only participants (student, tutor) or admin can reschedule
        if (req.user.role !== "admin" &&
            session.studentId.toString() !== req.user._id.toString() &&
            session.tutorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "fail",
                message: "Bạn không có quyền lên lịch lại phiên học này",
            });
        }

        // Store old values for history
        const oldSchedule = {
            startDate: session.startDate,
            endDate: session.endDate,
            time: session.time,
        };

        // Update with new schedule
        session.startDate = new Date(newStartDate);
        session.endDate = new Date(newEndDate);
        session.time = newTime;
        session.rescheduleReason = reason;
        session.rescheduledBy = req.user._id;
        session.rescheduledAt = new Date();

        // Add to reschedule history if it doesn't exist
        if (!session.rescheduleHistory) {
            session.rescheduleHistory = [];
        }

        session.rescheduleHistory.push({
            oldSchedule,
            newSchedule: {
                startDate: session.startDate,
                endDate: session.endDate,
                time: session.time,
            },
            rescheduledBy: req.user._id,
            rescheduledAt: new Date(),
            reason,
        });

        await session.save();

        res.json({
            status: "success",
            message: "Phiên học đã được lên lịch lại thành công",
            data: session,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi lên lịch lại phiên học: " + error.message,
        });
    }
};

// Get session history for a specific class or booking
const getSessionHistory = async (req, res) => {
    try {
        const {classId, bookingId} = req.query;

        let query = {};

        if (classId) {
            const classData = await Class.findById(classId);
            if (!classData) {
                return res.status(404).json({
                    status: "fail",
                    message: "Không tìm thấy lớp học",
                });
            }

            query = {
                tutorId: classData.tutorId,
                studentId: classData.studentId,
            };
        } else if (bookingId) {
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                return res.status(404).json({
                    status: "fail",
                    message: "Không tìm thấy đặt lịch",
                });
            }

            query = {
                tutorId: booking.tutorId,
                studentId: booking.studentId,
            };
        } else {
            return res.status(400).json({
                status: "fail",
                message: "Vui lòng cung cấp ID lớp học hoặc ID đặt lịch",
            });
        }

        const sessions = await Session.find(query)
            .sort({startDate: -1})
            .populate({
                path: "tutorId",
                populate: {path: "userId", select: "name email avatar"}
            })
            .populate("studentId", "name email avatar");

        res.json({
            status: "success",
            results: sessions.length,
            data: sessions,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Có lỗi xảy ra khi lấy lịch sử phiên học: " + error.message,
        });
    }
};

module.exports = {
    createSession,
    getSessions,
    getSession,
    updateSession,
    completeSession,
    cancelSession,
    rescheduleSession,
    getSessionHistory,
};
