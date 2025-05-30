const Class = require("../models/class.model");
const Post = require("../models/class.model");
const Booking = require("../models/booking.model");
const User = require("../models/user.model");
const Tutor = require("../models/tutor.model");
const Payment = require("../models/payment.model");

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

    console.log(classes);

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

const getClassStats = async (req, res) => {
  try {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();

    // Map JS day (0-6) to day names
    const dayMapping = {
      0: "Sunday",
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
    };

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    // Base query conditions for the current month
    const monthCondition = {
      $or: [
        // Classes starting this month
        { startDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth } },
        // Classes ending this month
        { endDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth } },
        // Classes that started before this month but end after this month (spanning classes)
        {
          startDate: { $lt: firstDayOfMonth },
          endDate: { $gt: lastDayOfMonth },
        },
      ],
    };

    // Fetch all classes for this month for detailed processing
    const monthlyClasses = await Class.find(monthCondition).lean();

    // Helper function to determine if a class time has passed today
    const hasTimeSlotPassed = (timeSlot) => {
      if (!timeSlot) return false;

      const [startTime] = timeSlot.split("-");
      const [startHour, startMinute] = startTime.split(":").map(Number);

      // If current hour is greater, time has passed
      if (currentHour > startHour) return true;
      // If current hour is the same, check minutes
      if (currentHour === startHour && currentMinute > startMinute) return true;

      return false;
    };

    // Count classes by status with time consideration
    let completed = 0;
    let upcoming = 0;
    let canceled = 0;

    // Initialize distribution data structures
    const timeSlotStats = {};
    const dayStats = {};
    const timeSlotStatusStats = {};

    const allTimeSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00",
    ];

    const allDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    // Initialize all possible combinations
    allTimeSlots.forEach((slot) => {
      timeSlotStats[slot] = 0;
      timeSlotStatusStats[slot] = {
        active: 0,
        completed: 0,
        canceled: 0,
      };
    });

    allDays.forEach((day) => {
      dayStats[day] = 0;
    });

    monthlyClasses.forEach((cls) => {
      // Add to the appropriate statistics based on class status and time
      if (cls.status === "completed") {
        completed++;
      } else if (cls.status === "canceled") {
        canceled++;
      } else if (cls.status === "active") {
        // For active classes, we need to determine if they're truly upcoming
        const startDate = new Date(cls.startDate);
        const endDate = new Date(cls.endDate);
        const currentDate = today.getDate();

        // Check if class date range includes today
        const isInDateRange = today >= startDate && today <= endDate;

        // Check if today is the class day
        const isTodayClassDay = cls.day === dayMapping[currentDay];

        // If class is today, check if time has passed
        if (isInDateRange && isTodayClassDay) {
          // If time hasn't passed, it's upcoming for today
          if (!hasTimeSlotPassed(cls.timeSlot)) {
            upcoming++;
          }
          // Otherwise, it's passed for today but still active
          // If class recurs in the future (within date range), it's still upcoming
        } else if (endDate > today) {
          // Class hasn't reached end date
          upcoming++;
        }
      }

      // Update time slot statistics
      if (cls.timeSlot) {
        timeSlotStats[cls.timeSlot] = (timeSlotStats[cls.timeSlot] || 0) + 1;

        // Update time slot by status
        if (timeSlotStatusStats[cls.timeSlot]) {
          timeSlotStatusStats[cls.timeSlot][cls.status] =
            (timeSlotStatusStats[cls.timeSlot][cls.status] || 0) + 1;
        }
      }

      // Update day statistics
      if (cls.day) {
        dayStats[cls.day] = (dayStats[cls.day] || 0) + 1;
      }
    });

    // Get the top time slots and days
    const sortedTimeSlots = Object.entries(timeSlotStats)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        if (value > 0) obj[key] = value;
        return obj;
      }, {});

    const sortedDays = Object.entries(dayStats)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        if (value > 0) obj[key] = value;
        return obj;
      }, {});

    // Format time slot by status for API response
    const formattedTimeSlotStatus = {};
    Object.entries(timeSlotStatusStats).forEach(([slot, statuses]) => {
      // Only include time slots that have classes
      const total = Object.values(statuses).reduce(
        (sum, count) => sum + count,
        0
      );
      if (total > 0) {
        formattedTimeSlotStatus[slot] = statuses;
      }
    });

    res.json({
      status: "success",
      data: {
        total: monthlyClasses.length,
        completed,
        upcoming,
        canceled,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        timeSlotDistribution: sortedTimeSlots,
        dayDistribution: sortedDays,
        timeSlotStatusDistribution: formattedTimeSlotStatus,
        currentTime: {
          day: dayMapping[currentDay],
          hour: currentHour,
          minute: currentMinute,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thống kê buổi học: " + error.message,
    });
  }
};

const getRevenueStats = async (req, res) => {
  // log ra data getRevenueStats
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const firstDayOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastDayOfLastMonth = new Date(currentYear, currentMonth, 0);

    const currentMonthRevenue = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: {
            $gte: firstDayOfMonth,
            $lte: lastDayOfMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const lastMonthRevenue = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: {
            $gte: firstDayOfLastMonth,
            $lte: lastDayOfLastMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // const pendingRevenue = await Payment.aggregate([
    //   {
    //     $match: {
    //       status: "pending",
    //       createdAt: {
    //         $gte: firstDayOfMonth,
    //         $lte: lastDayOfMonth,
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       total: { $sum: "$amount" },
    //     },
    //   },
    // ]);

    // const completedRevenue = await Payment.aggregate([
    //   {
    //     $match: {
    //       status: "completed",
    //       createdAt: {
    //         $gte: firstDayOfMonth,
    //         $lte: lastDayOfMonth,
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       total: { $sum: "$amount" },
    //     },
    //   },
    // ]);

    const monthlyRevenue =
      currentMonthRevenue.length > 0 ? currentMonthRevenue[0].total : 0;
    const prevMonthRevenue =
      lastMonthRevenue.length > 0 ? lastMonthRevenue[0].total : 0;
    // const pendingPayments =
    //   pendingRevenue.length > 0 ? pendingRevenue[0].total : 0;
    // const completedPayments =
    //   completedRevenue.length > 0 ? completedRevenue[0].total : 0;

    let percentChange = 0;
    if (prevMonthRevenue > 0) {
      percentChange = Math.round(
        ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      );
    }

    console.log("monthlyRevenue", monthlyRevenue);
    console.log("prevMonthRevenue", prevMonthRevenue);

    res.json({
      status: "success",
      data: {
        monthlyRevenue: monthlyRevenue,
        // pendingPayments: pendingPayments,
        // completedPayments: completedPayments,
        percentIncrease: percentChange,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thống kê doanh thu: " + error.message,
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
  getClassStats,
  getRevenueStats,
};
