const Booking = require("../models/booking.model");
const Tutor = require("../models/tutor.model");
const Session = require("../models/session.model");
const User = require("../models/user.model");
const { createRoom } = require("../utils/stringee");

const createBooking = async (req, res) => {
  try {
    const studentId = req.user._id;
    const tutorId = req.params.tutorId;
    const { subject, grade, time, day, startDate, endDate, requirements } =
      req.body;

    // Kiểm tra thời gian hợp lệ
    const availableSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00",
      "19:00-21:00",
    ];

    console.log(time);

    if (!availableSlots.find((availableTime) => availableTime === time)) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian học không hợp lệ. Vui lòng chọn ca học hợp lệ",
      });
    }

    // Đảm bảo day luôn là một mảng
    const dayArray = Array.isArray(day) ? day : [day];

    // Kiểm tra giảng viên tồn tại
    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy giảng viên",
      });
    }

    // Kiểm tra giảng viên có dạy môn học này không
    const subjectExists = tutor.subjects.some(
      (subjectObj) => subjectObj.subject === subject
    );
    if (!subjectExists) {
      return res.status(400).json({
        status: "fail",
        message: "Giảng viên không dạy môn học này",
      });
    }
    // Kiểm tra giảng viên có dạy lớp này không
    const gradeExists = tutor.subjects.some((subjectObj) =>
      subjectObj.grades.includes(grade)
    );
    if (!gradeExists) {
      return res.status(400).json({
        status: "fail",
        message: "Giảng viên không dạy lớp này",
      });
    }

    const availableScheduleExists = dayArray.some((singleDay) => {
      const daySchedule = tutor.availableSchedule.find(
        (schedule) => schedule.day === singleDay
      );
      if (!daySchedule) return false;
      return daySchedule.timeSlots.includes(time);
    });
    if (!availableScheduleExists) {
      return res.status(400).json({
        status: "fail",
        message: "Giảng viên không có lịch trống vào thời gian này",
      });
    }

    // Kiểm tra lịch trống của giảng viên
    let hasConflict = false;
    let existingSession = null;

    // Helper function to get all occurrences of specific weekdays within a date range
    const getWeekdayDatesInRange = (startDate, endDate, weekdays) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates = [];

      // Map day strings to day numbers (0 = Sunday, 1 = Monday, etc.)
      const dayMapping = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      // Convert weekday strings to day numbers
      const dayNumbers = weekdays.map((day) => dayMapping[day.toLowerCase()]);

      // Clone the start date
      const current = new Date(start);

      // Iterate through each date in the range
      while (current <= end) {
        const dayOfWeek = current.getDay();

        // If current day is in our weekdays list, add it
        if (dayNumbers.includes(dayOfWeek)) {
          dates.push(new Date(current));
        }

        // Move to next day
        current.setDate(current.getDate() + 1);
      }

      return dates;
    };

    // Get actual calendar dates for the requested booking
    const requestedDates = getWeekdayDatesInRange(startDate, endDate, dayArray);

    // If no specific dates match the criteria, there's nothing to book
    if (requestedDates.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Không có ngày học nào phù hợp trong khoảng thời gian đã chọn",
      });
    }

    // Find all sessions that might conflict
    const potentialConflictSessions = await Session.find({
      $or: [{ studentId: studentId }, { tutorId: tutorId }],
      // tutorId: tutorId,
      time: time,
      status: "active",
    });

    // Check each potential conflict session for actual date conflicts
    for (const session of potentialConflictSessions) {
      // Get actual calendar dates for the existing session
      const sessionDates = getWeekdayDatesInRange(
        session.startDate,
        session.endDate,
        session.day
      );

      // Check if any specific dates overlap
      const conflictingDates = requestedDates.filter((reqDate) =>
        sessionDates.some(
          (sessDate) =>
            reqDate.getFullYear() === sessDate.getFullYear() &&
            reqDate.getMonth() === sessDate.getMonth() &&
            reqDate.getDate() === sessDate.getDate()
        )
      );

      if (conflictingDates.length > 0) {
        hasConflict = true;
        existingSession = session;
        break;
      }
    }

    // Nếu có xung đột lịch
    if (hasConflict) {
      return res.status(400).json({
        status: "fail",
        message:
          "Bạn đã có lịch học vào thời gian này hoặc giảng viên đã có lịch học vào thời gian này",
        data: {
          session: existingSession,
        },
      });
    }

    const user = await User.findById(studentId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }

    if (user.balance < tutor.sessionPrice * requestedDates.length) {
      return res.status(400).json({
        status: "fail",
        message: "Số dư không đủ để đặt lịch học",
      });
    }
    // Trừ tiền trong tài khoản của người dùng
    user.balance -= tutor.sessionPrice * requestedDates.length;
    await user.save();
    await tutor.save();

    const userTutor = await User.findById(tutor.userId);
    if (!userTutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng giảng viên",
      });
    }
    // Cập nhật số dư của giảng viên
    userTutor.pendingBalance = tutor.sessionPrice * requestedDates.length;
    await userTutor.save();

    // Không có xung đột lịch, tự động chấp nhận booking
    // Tạo session mới
    const newSession = new Session({
      studentId,
      tutorId,
      time,
      day: dayArray,
      sessionPrice: tutor.sessionPrice,
      subject,
      grade,
      requirements,
      startDate,
      endDate,
      status: "active",
      roomId: await createRoom(studentId, tutorId),
    });

    await newSession.save();

    // Tạo booking với trạng thái đã chấp nhận
    const booking = new Booking({
      tutorId,
      studentId,
      subject,
      grade,
      time,
      day: dayArray,
      startDate,
      endDate,
      requirements,
      status: "accepted", // Tự động chấp nhận booking
      sessionId: newSession._id,
    });

    await booking.save();

    // Cập nhật session với booking ID
    newSession.bookingId = booking._id;
    await newSession.save();

    // Thông báo thành công
    res.status(201).json({
      status: "success",
      message: "Đặt lịch học thành công",
      data: {
        booking,
        session: newSession,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi đặt lịch học: " + error.message,
    });
  }
};

const getBookings = async (req, res) => {
  try {
    const role = req.user.role;
    if (role === "tutor") {
      return getBookingsOfTutor(req, res);
    }
    return getBookingsOfUser(req, res);
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lịch hẹn: " + error.message,
    });
  }
};

const getBookingsOfTutor = async (req, res) => {
  try {
    const userId = req.user._id;
    const tutor = await Tutor.findOne({ userId });
    const bookings = await Booking.find({ tutorId: tutor._id }).populate({
      path: "tutorId",
      populate: {
        path: "userId",
        select: "name email avatar",
      },
    });

    res.json({
      status: "success",
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lịch hẹn: " + error.message,
    });
  }
};

const getBookingsOfUser = async (req, res) => {
  try {
    const studentId = req.user._id;
    const bookings = await Booking.find({ studentId }).populate({
      path: "tutorId",
      populate: {
        path: "userId",
        select: "name email avatar",
      },
    });
    res.json({
      status: "success",
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lịch hẹn: " + error.message,
    });
  }
};

const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate({
      path: "tutorId.userId",
      select: "name email avatar",
    });
    if (!booking) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lịch hẹn",
      });
    }
    res.json({
      status: "success",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tìm lịch hẹn: " + error.message,
    });
  }
};

const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!booking) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lịch hẹn",
      });
    }
    res.json({
      status: "success",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật lịch hẹn: " + error.message,
    });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // Kiểm tra quyền hủy lịch
    let canceledBy;
    if (userRole === "tutor") {
      const tutor = await Tutor.findOne({ userId });
      if (!tutor || tutor._id.toString() !== booking.tutorId.toString()) {
        return res.status(403).json({
          status: "fail",
          message: "Bạn không có quyền hủy lịch hẹn này",
        });
      }
      canceledBy = "tutor";
    } else if (userRole === "student" || userRole === "admin") {
      if (
        userRole === "student" &&
        booking.studentId.toString() !== userId.toString()
      ) {
        return res.status(403).json({
          status: "fail",
          message: "Bạn không có quyền hủy lịch hẹn này",
        });
      }
      canceledBy = userRole === "student" ? "student" : "admin";
    }

    // Cập nhật trạng thái booking
    booking.status = "canceled";
    booking.canceledBy = canceledBy;
    booking.cancelReason = reason || "Không có lý do được cung cấp";

    // Nếu tutor hủy lịch, giảm điểm uy tín
    if (canceledBy === "tutor") {
      const tutor = await Tutor.findById(booking.tutorId);

      // Tính thời gian còn lại trước buổi học (tính theo giờ)
      const bookingStartDate = new Date(booking.startDate);
      const now = new Date();
      const hoursRemaining = Math.max(
        0,
        (bookingStartDate - now) / (1000 * 60 * 60)
      );

      let penaltyPoints = 0;

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

      // Trừ điểm uy tín
      tutor.trustScore = Math.max(0, tutor.trustScore - penaltyPoints);
      await tutor.save();
    }

    await booking.save();

    // Xóa session nếu có
    if (booking.sessionId) {
      await Session.findByIdAndDelete(booking.sessionId);
    }

    res.json({
      status: "success",
      message: "Hủy lịch hẹn thành công",
      data: {
        booking,
        trustScoreDeducted: canceledBy === "tutor" ? penaltyPoints : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi hủy lịch hẹn: " + error.message,
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBooking,
  updateBooking,
  cancelBooking,
};
