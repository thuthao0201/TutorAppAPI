const Class = require("../models/class.model");
const Post = require("../models/class.model");
const Booking = require("../models/booking.model");
const User = require("../models/user.model");
const Tutor = require("../models/tutor.model");

// Create a new class
const createClass = async (req, res) => {
  try {
    const {
      postId,
      bookingId,
      subject,
      grade,
      time,
      startDate,
      endDate,
      requirements,
    } = req.body;

    // Generate a unique room ID
    const roomId = `room_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    let tutorId, studentId;

    // If class is created from a post
    if (postId) {
      const postData = await Post.findById(postId);
      if (!postData) {
        return res.status(404).json({
          status: "fail",
          message: "Không tìm thấy bài đăng",
        });
      }

      tutorId = postData.tutorId;
      studentId = postData.studentId;

      // Create the class
      const classObj = new Class({
        roomId,
        tutorId,
        studentId,
        subject: subject || postData.subject,
        grade: grade || postData.grade,
        time: time || postData.preferredTime,
        startDate: startDate || postData.startDate,
        endDate: endDate || postData.endDate,
        requirements: requirements || postData.requirements,
      });

      await classObj.save();

      // Update post with class ID
      postData.classId = classObj._id;
      await postData.save();

      return res.status(201).json({
        status: "success",
        data: classObj,
      });
    }

    // If class is created from a booking
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          status: "fail",
          message: "Không tìm thấy đặt lịch",
        });
      }

      // Create the class
      const classObj = new Class({
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

      await classObj.save();

      // Update booking with class ID
      booking.classId = classObj._id;
      await booking.save();

      return res.status(201).json({
        status: "success",
        data: classObj,
      });
    }

    // If class is created directly
    const classObj = new Class({
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

    await classObj.save();

    return res.status(201).json({
      status: "success",
      data: classObj,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo lớp học: " + error.message,
    });
  }
};

// Get all classes with filtering options
const getClasses = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    let query = {};

    // Filter by date range if provided
    if (req.query.startDate && req.query.endDate) {
      query.startDate = { $gte: new Date(req.query.startDate) };
      query.endDate = { $lte: new Date(req.query.endDate) };
    }

    // Filter by subject if provided
    if (req.query.subject) {
      query.subject = req.query.subject;
    }

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // For tutors, show only their classes
    if (role === "tutor") {
      const tutor = await Tutor.findOne({ userId });
      if (!tutor) {
        return res.status(404).json({
          status: "fail",
          message: "Không tìm thấy thông tin gia sư",
        });
      }
      query.tutorId = tutor._id;
    }
    // For students, show only their classes
    else {
      query.studentId = userId;
    }
    // Admin can see all classes
    console.log(role);

    console.log(query);

    const classes = await Class.find(query)
      .populate({
        path: "tutorId",
        populate: { path: "userId", select: "name email avatar phone" },
      })
      .populate("studentId", "name email avatar")
      .sort({ startDate: -1 });

    res.json({
      status: "success",
      results: classes.length,
      data: classes,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lớp học: " + error,
    });
  }
};

// Get specific class by ID
const getClass = async (req, res) => {
  try {
    const classObj = await Class.findById(req.params.id)
      .populate({
        path: "tutorId",
        populate: { path: "userId", select: "name email avatar phone" },
      })
      .populate("studentId", "name email avatar phone");

    if (!classObj) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lớp học",
      });
    }

    // Check permissions - only related users or admins can view class details
    if (
      req.user.role !== "admin" &&
      classObj.studentId._id.toString() !== req.user._id.toString() &&
      classObj.tutorId.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền truy cập thông tin này",
      });
    }

    res.json({
      status: "success",
      data: classObj,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thông tin lớp học: " + error.message,
    });
  }
};

// Update class details
const updateClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const classObj = await Class.findById(classId);

    if (!classObj) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lớp học",
      });
    }

    // Only tutors assigned to this class or admins can update
    if (
      req.user.role !== "admin" &&
      classObj.tutorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền cập nhật lớp học này",
      });
    }

    // Update class with provided data
    const updatedClass = await Class.findByIdAndUpdate(classId, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      status: "success",
      data: updatedClass,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật lớp học: " + error.message,
    });
  }
};

// Mark class as completed
const completeClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const { notes, rating } = req.body;

    const classObj = await Class.findById(classId);

    if (!classObj) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lớp học",
      });
    }

    // Only tutors assigned to this class or admins can mark as complete
    if (
      req.user.role !== "admin" &&
      classObj.tutorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    classObj.status = "completed";
    classObj.completedAt = new Date();
    classObj.notes = notes;

    // Thưởng điểm uy tín cho tutor khi hoàn thành buổi học
    const tutor = await Tutor.findById(classObj.tutorId);

    // Thêm điểm uy tín, nhưng không vượt quá 100
    const rewardPoints = 1; // Thưởng 1 điểm cho mỗi buổi học hoàn thành
    tutor.trustScore = Math.min(100, tutor.trustScore + rewardPoints);

    // Tính số buổi học thành công liên tiếp
    if (!tutor.consecutiveCompletedSessions) {
      tutor.consecutiveCompletedSessions = 0;
    }
    tutor.consecutiveCompletedSessions += 1;

    // Thưởng thêm điểm nếu có chuỗi buổi học thành công liên tiếp
    if (tutor.consecutiveCompletedSessions % 5 === 0) {
      // Thưởng thêm 2 điểm sau mỗi 5 buổi học thành công liên tiếp
      const bonusPoints = 2;
      tutor.trustScore = Math.min(100, tutor.trustScore + bonusPoints);
    }

    // If rating is provided, update it
    if (rating) {
      classObj.rating = rating;

      // Update tutor's average rating
      const newTotalRating = tutor.avgRating * tutor.totalReviews + rating;
      tutor.totalReviews += 1;
      tutor.avgRating = newTotalRating / tutor.totalReviews;
    }

    await tutor.save();
    await classObj.save();

    // Increment completedSessions for the tutor
    await Tutor.findByIdAndUpdate(classObj.tutorId, {
      $inc: {
        completedSessions: 1,
        consecutiveCompletedSessions: 1,
        totalSessions: 1,
      },
    });

    res.json({
      status: "success",
      message: "Lớp học đã được đánh dấu là hoàn thành",
      data: {
        class: classObj,
        trustScoreAdded:
          rewardPoints + (tutor.consecutiveCompletedSessions % 5 === 0 ? 2 : 0),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi hoàn thành lớp học: " + error.message,
    });
  }
};

// Cancel a class
const cancelClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Tìm class cần hủy
    const classObj = await Class.findById(id);

    if (!classObj) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy buổi học này",
      });
    }

    // Kiểm tra nếu buổi học đã hoàn thành
    if (classObj.status === "completed") {
      return res.status(400).json({
        status: "fail",
        message: "Không thể hủy buổi học đã hoàn thành",
      });
    }

    // Kiểm tra quyền hủy class
    let canceledBy;
    if (userRole === "tutor") {
      const tutor = await Tutor.findOne({ userId });
      if (!tutor || tutor._id.toString() !== classObj.tutorId.toString()) {
        return res.status(403).json({
          status: "fail",
          message: "Bạn không có quyền hủy buổi học này",
        });
      }
      canceledBy = "tutor";
    } else if (userRole === "student") {
      if (
        classObj.studentId &&
        classObj.studentId.toString() !== userId.toString()
      ) {
        return res.status(403).json({
          status: "fail",
          message: "Bạn không có quyền hủy buổi học này",
        });
      }
      canceledBy = "student";
    } else if (userRole === "admin") {
      canceledBy = "admin";
    }

    // Cập nhật trạng thái class
    classObj.status = "canceled";
    classObj.canceledBy = canceledBy;
    classObj.cancelReason = reason || "Không có lý do được cung cấp";
    classObj.canceledAt = new Date();

    // Nếu giảng viên hủy class, tính điểm phạt
    let penaltyPoints = 0;
    if (canceledBy === "tutor") {
      const tutor = await Tutor.findById(classObj.tutorId);

      // Tính thời gian còn lại trước buổi học (tính theo giờ)
      const classStartDate = new Date(classObj.startDate);
      const now = new Date();
      const hoursRemaining = Math.max(
        0,
        (classStartDate - now) / (1000 * 60 * 60)
      );

      // Tính điểm phạt dựa trên thời gian còn lại
      if (hoursRemaining < 2) {
        // Hủy gấp (dưới 2 giờ trước buổi học)
        penaltyPoints = 10;
      } else if (hoursRemaining < 24) {
        // Hủy trong ngày (dưới 24 giờ)
        penaltyPoints = 5;
      } else if (hoursRemaining < 72) {
        // Hủy trước 3 ngày
        penaltyPoints = 3;
      } else {
        // Hủy sớm (trước 3 ngày trở lên)
        penaltyPoints = 1;
      }

      // Trừ điểm uy tín của giảng viên
      if (tutor) {
        tutor.trustScore = Math.max(0, tutor.trustScore - penaltyPoints);
        tutor.consecutiveCompletedSessions = 0; // Reset số buổi học thành công liên tiếp
        await tutor.save();
      }
    }

    await classObj.save();

    // Nếu class liên kết với booking, cập nhật trạng thái booking
    if (classObj.bookingId) {
      const booking = await Booking.findById(classObj.bookingId);
      if (booking) {
        booking.status = "canceled";
        booking.canceledBy = canceledBy;
        booking.cancelReason = reason || "Không có lý do được cung cấp";
        await booking.save();
      }
    }

    // Reset consecutive completed sessions counter for the tutor
    await Tutor.findByIdAndUpdate(classObj.tutorId, {
      consecutiveCompletedSessions: 0,
    });

    res.json({
      status: "success",
      message: "Hủy buổi học thành công",
      data: {
        class: classObj,
        trustScoreDeducted: canceledBy === "tutor" ? penaltyPoints : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi hủy buổi học: " + error.message,
    });
  }
};

// Reschedule a class
const rescheduleClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const { newStartDate, newEndDate, newTime, reason } = req.body;

    if (!newStartDate || !newEndDate || !newTime) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng cung cấp thời gian mới cho lớp học",
      });
    }

    const classObj = await Class.findById(classId);

    if (!classObj) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lớp học",
      });
    }

    // Only participants (student, tutor) or admin can reschedule
    if (
      req.user.role !== "admin" &&
      classObj.studentId.toString() !== req.user._id.toString() &&
      classObj.tutorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền lên lịch lại lớp học này",
      });
    }

    // Store old values for history
    const oldSchedule = {
      startDate: classObj.startDate,
      endDate: classObj.endDate,
      time: classObj.time,
    };

    // Update with new schedule
    classObj.startDate = new Date(newStartDate);
    classObj.endDate = new Date(newEndDate);
    classObj.time = newTime;
    classObj.rescheduleReason = reason;
    classObj.rescheduledBy = req.user._id;
    classObj.rescheduledAt = new Date();

    // Add to reschedule history if it doesn't exist
    if (!classObj.rescheduleHistory) {
      classObj.rescheduleHistory = [];
    }

    classObj.rescheduleHistory.push({
      oldSchedule,
      newSchedule: {
        startDate: classObj.startDate,
        endDate: classObj.endDate,
        time: classObj.time,
      },
      rescheduledBy: req.user._id,
      rescheduledAt: new Date(),
      reason,
    });

    await classObj.save();

    res.json({
      status: "success",
      message: "Lớp học đã được lên lịch lại thành công",
      data: classObj,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lên lịch lại lớp học: " + error.message,
    });
  }
};

// Get class history for a specific post or booking
const getClassHistory = async (req, res) => {
  try {
    const { postId, bookingId } = req.query;

    let query = {};

    if (postId) {
      const postData = await Post.findById(postId);
      if (!postData) {
        return res.status(404).json({
          status: "fail",
          message: "Không tìm thấy bài đăng",
        });
      }

      query = {
        tutorId: postData.tutorId,
        studentId: postData.studentId,
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
        message: "Vui lòng cung cấp ID bài đăng hoặc ID đặt lịch",
      });
    }

    const classes = await Class.find(query)
      .sort({ startDate: -1 })
      .populate({
        path: "tutorId",
        populate: { path: "userId", select: "name email avatar" },
      })
      .populate("studentId", "name email avatar");

    res.json({
      status: "success",
      results: classes.length,
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy lịch sử lớp học: " + error.message,
    });
  }
};

module.exports = {
  createClass,
  getClasses,
  getClass,
  updateClass,
  completeClass,
  cancelClass,
  rescheduleClass,
  getClassHistory,
};
