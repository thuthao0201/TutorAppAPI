const Booking = require("../models/booking.model");
const Tutor = require("../models/tutor.model");
const Session = require("../models/session.model"); // Add Session model

// Xem lai thoi gian dat lich duoi dang nhu nao
// Lam the nao de co the check duoc ca cac ngay dua tren ngay bat dau va ket thuc
// Xac dinh lai bai toan ve thoi gian dat lich
const createBooking = async (req, res) => {
  try {
    const tutorId = req.params.tutorId;
    const studentId = req.user._id;
    const {subject, grade, time, day, startDate, endDate, requirements} = req.body;
    const availableSlots = [
      "07:00-09:00",
      "09:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "18:00-20:00",
    ];

    if (!availableSlots.includes(time)) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian đặt lịch không hợp lệ. Vui lòng chọn ca học hợp lệ",
      });
    }

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy gia sư",
      });
    }

    // Check for session conflicts
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Find all sessions that overlap with the requested time period
    const overlappingSessions = await Session.find({
      tutorId,
      day,
      time,
      $or: [
        // Sessions that start during our range
        {
          startDate: {$lte: end},
          endDate: {$gte: start}
        }
      ]
    });

    if (overlappingSessions.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "Đã có buổi học trùng vào ca này trong khoảng thời gian bạn chọn. Vui lòng chọn ca học khác.",
      });
    }

    // Create a new session for the booking
    const session = new Session({
      tutorId,
      studentId,
      subject,
      grade,
      time,
      day,
      startDate,
      endDate,
      requirements
    });

    await session.save();
    await tutor.save();

    // Create booking with session reference
    const booking = new Booking({
      tutorId,
      userId: studentId,
      time,
      day,
      startDate,
      endDate,
      sessionId: session._id,
      status: "accepted",
      subject,
      grade,
      requirements
    });

    await booking.save();

    res.status(201).json({
      status: "success",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo lịch hẹn: " + error.message,
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
    const booking = await Booking.findById(req.params.id);
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
    const booking = await Booking.findByIdAndUpdate(req.params.id, {
      status: "cancelled",
    });
    if (!booking) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // await booking.deleteOne();
    res.json({
      status: "success",
      message: "Hủy lịch hẹn thành công",
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
