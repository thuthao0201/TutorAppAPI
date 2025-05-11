const Booking = require("../models/booking.model");
const Tutor = require("../models/tutor.model");
const Class = require("../models/class.model");
const User = require("../models/user.model");

const createBooking = async (req, res) => {
  try {
    const studentId = req.user._id;
    const tutorId = req.params.tutorId;
    const {subject, grade, timeSlot, day, startDate, endDate, requirements} = req.body;

    // Kiểm tra thời gian hợp lệ
    const availableSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00",
      "19:00-21:00",
    ];

    if (!availableSlots.includes(timeSlot)) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian học không hợp lệ. Vui lòng chọn ca học hợp lệ",
      });
    }

    // Kiểm tra ngày trong tuần hợp lệ
    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    if (!validDays.includes(day)) {
      return res.status(400).json({
        status: "fail",
        message: "Ngày học không hợp lệ. Vui lòng chọn ngày hợp lệ",
      });
    }

    // Kiểm tra giảng viên tồn tại
    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy giảng viên",
      });
    }

    // Kiểm tra giảng viên có dạy môn học này không
    const subjectExists = tutor.subjects.some(subjectObj => subjectObj.name === subject);
    if (!subjectExists) {
      return res.status(400).json({
        status: "fail",
        message: "Giảng viên không dạy môn học này",
      });
    }

    // Kiểm tra giảng viên có dạy lớp này không
    const gradeExists = tutor.subjects.some(subjectObj => subjectObj.grades.includes(grade) && subjectObj.name === subject);
    if (!gradeExists) {
      return res.status(400).json({
        status: "fail",
        message: "Giảng viên không dạy lớp này",
      });
    }

    // Kiểm tra ca học có phù hợp với lịch của giảng viên không
    const daySchedule = tutor.availableSchedule.find(schedule => schedule.day === day);
    if (!daySchedule || !daySchedule.timeSlots.includes(timeSlot)) {
      return res.status(400).json({
        status: "fail",
        message: "Giảng viên không có lịch vào thời gian này",
      });
    }

    // Chuẩn hóa ngày bắt đầu và kết thúc
    const normalizedDates = normalizeStartAndEndDates(new Date(startDate), new Date(endDate), day);
    if (!normalizedDates) {
      return res.status(400).json({
        status: "fail",
        message: "Không thể chuẩn hóa ngày bắt đầu và kết thúc",
      });
    }

    const normalizedStartDate = normalizedDates.startDate;
    const normalizedEndDate = normalizedDates.endDate;

    // Kiểm tra xem có lớp học nào trùng lịch không
    let hasConflict = false;
    let existingClass = null;

    // Kiểm tra lịch trùng dựa trên timeSlot và day
    const potentialConflicts = await Class.find({
      $or: [
        {studentId: studentId},
        {tutorId: tutorId}
      ],
      timeSlot: timeSlot,
      day: day,
      status: "active"
    });

    // Kiểm tra xem có trùng ngày cụ thể không
    if (potentialConflicts.length > 0) {
      for (const cls of potentialConflicts) {
        // Kiểm tra xem có trùng thời gian không
        if (datesOverlap(normalizedStartDate, normalizedEndDate, cls.startDate, cls.endDate)) {
          hasConflict = true;
          existingClass = cls;
          break;
        }
      }
    }

    // Nếu có xung đột lịch
    if (hasConflict) {
      return res.status(400).json({
        status: "fail",
        message:
          "Bạn đã có lịch học vào thời gian này hoặc giảng viên đã có lịch học vào thời gian này",
        data: {
          class: existingClass
        }
      });
    }

    // Kiểm tra số dư của người dùng
    const user = await User.findById(studentId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }

    // Tính số buổi học
    const numberOfSessions = countSessionsBetweenDates(normalizedStartDate, normalizedEndDate, day);

    if (numberOfSessions === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Không có buổi học nào trong khoảng thời gian đã chọn",
      });
    }

    const totalPrice = tutor.classPrice * numberOfSessions;

    if (user.balance < totalPrice) {
      return res.status(400).json({
        status: "fail",
        message: "Số dư không đủ để đặt lịch học",
      });
    }

    // Trừ tiền trong tài khoản của người dùng
    user.balance -= totalPrice;
    await user.save();

    // Cập nhật số dư chờ của giảng viên
    const userTutor = await User.findById(tutor.userId);
    if (!userTutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng giảng viên",
      });
    }

    userTutor.pendingBalance += totalPrice;
    await userTutor.save();

    // Tạo lớp học mới
    const newClass = new Class({
      studentId,
      tutorId,
      timeSlot,
      day,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      subject,
      grade,
      requirements,
      classPrice: totalPrice,
      status: "active"
    });

    await newClass.save();

    // Tạo booking với trạng thái đã chấp nhận
    const booking = new Booking({
      tutorId,
      studentId,
      subject,
      grade,
      timeSlot,
      day,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      requirements,
      status: "submitted",
      classId: newClass._id
    });

    await booking.save();

    // Thông báo thành công
    res.status(201).json({
      status: "success",
      message: "Đặt lịch học thành công",
      data: {
        booking,
        class: newClass
      }
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi đặt lịch học: " + error.message,
    });
  }
};

// Hàm chuẩn hóa ngày bắt đầu và kết thúc dựa theo ngày trong tuần
function normalizeStartAndEndDates (startDate, endDate, dayOfWeek) {
  try {
    const dayMap = {
      "Monday": 1,
      "Tuesday": 2,
      "Wednesday": 3,
      "Thursday": 4,
      "Friday": 5,
      "Saturday": 6,
      "Sunday": 0
    };

    const dayNumber = dayMap[dayOfWeek];
    if (dayNumber === undefined) return null;

    // Tìm ngày đầu tiên sau hoặc bằng ngày bắt đầu
    const normalizedStartDate = new Date(startDate);
    while (normalizedStartDate.getDay() !== dayNumber) {
      normalizedStartDate.setDate(normalizedStartDate.getDate() + 1);
    }

    // Tìm ngày cuối cùng trước hoặc bằng ngày kết thúc
    const normalizedEndDate = new Date(endDate);
    while (normalizedEndDate.getDay() !== dayNumber) {
      normalizedEndDate.setDate(normalizedEndDate.getDate() - 1);
    }

    // Nếu ngày bắt đầu sau ngày kết thúc sau khi chuẩn hóa, trả về null
    if (normalizedStartDate > normalizedEndDate) return null;

    return {startDate: normalizedStartDate, endDate: normalizedEndDate};
  } catch (error) {
    console.error("Error normalizing dates:", error);
    return null;
  }
}

// Kiểm tra xem hai khoảng thời gian có trùng nhau không
function datesOverlap (start1, end1, start2, end2) {
  return start1 <= end2 && start2 <= end1;
}

// Đếm số buổi học giữa hai ngày với ngày cụ thể trong tuần
function countSessionsBetweenDates (startDate, endDate, dayOfWeek) {
  const dayMap = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 0
  };

  const dayNumber = dayMap[dayOfWeek];
  let count = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (currentDate.getDay() === dayNumber) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return count;
}

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
    const tutor = await Tutor.findOne({userId});
    const bookings = await Booking.find({tutorId: tutor._id});
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
    const userId = req.user._id;
    const bookings = await Booking.find({userId});
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
    const {reason} = req.body;
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
      const tutor = await Tutor.findOne({userId});
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
    let penaltyPoints = 0;
    if (canceledBy === "tutor") {
      const tutor = await Tutor.findById(booking.tutorId);

      // Tính thời gian còn lại trước buổi học (tính theo giờ)
      const bookingStartDate = new Date(booking.startDate);
      const now = new Date();
      const hoursRemaining = Math.max(
        0,
        (bookingStartDate - now) / (1000 * 60 * 60)
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

      // Trừ điểm uy tín
      tutor.trustScore = Math.max(0, tutor.trustScore - penaltyPoints);
      await tutor.save();
    }

    await booking.save();

    // Xóa class nếu có
    if (booking.classId) {
      await Class.findByIdAndUpdate(booking.classId, {
        status: "canceled",
        canceledBy: canceledBy,
        cancelReason: reason || "Không có lý do được cung cấp"
      });
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
