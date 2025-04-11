const Class = require("../models/class.model");
const Tutor = require("../models/tutor.model");
const Booking = require("../models/booking.model");
const Session = require("../models/session.model");

// Tạo lớp mới từ học viên
const createClass = async (req, res) => {
  try {
    const studentId = req.user._id;
    const {subject, grade, time, day, startDate, endDate, requirements} = req.body;

    // Kiểm tra thời gian hợp lệ
    const availableSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00"
    ];

    if (!availableSlots.includes(time)) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian học không hợp lệ. Vui lòng chọn ca học hợp lệ",
      });
    }

    // Đảm bảo day luôn là một mảng
    const dayArray = Array.isArray(day) ? day : [day];

    // Tìm giảng viên có thể dạy môn học này
    const tutors = await Tutor.find({
      "subjects": {
        $elemMatch: {
          "subject": subject,
          "grades": grade
        }
      }
    });

    if (tutors.length === 0) {
      // Nếu không có giảng viên dạy môn học này
      const newClass = new Class({
        subject,
        grade,
        studentId,
        time,
        day: dayArray,
        startDate,
        endDate,
        requirements,
        status: "pending"
      });

      await newClass.save();

      return res.status(201).json({
        status: "success",
        message: "Không tìm thấy giảng viên dạy môn học này. Vui lòng thử môn học khác.",
        data: {
          class: newClass
        }
      });
    }

    // Kiểm tra xung đột lịch giảng viên
    const availableTutor = await checkTutorAvailability(tutors, time, dayArray, startDate, endDate);

    if (availableTutor) {
      // Tạo session mới cho lớp học
      const newSession = new Session({
        tutorId: availableTutor._id,
        time,
        day: dayArray,
        startDate,
        endDate,
        status: "active"
      });

      await newSession.save();

      // Tạo lớp học với trạng thái matched
      const newClass = new Class({
        subject,
        grade,
        studentId,
        tutorId: availableTutor._id,
        time,
        day: dayArray,
        startDate,
        endDate,
        requirements,
        sessionId: newSession._id,
        status: "matched"
      });

      await newClass.save();

      // Tạo booking tương ứng
      const booking = new Booking({
        tutorId: availableTutor._id,
        userId: studentId,
        time,
        day: dayArray,
        startDate,
        endDate,
        requirements,
        status: "accepted"
      });

      await booking.save();

      // Cập nhật lớp với booking ID
      newClass.bookingId = booking._id;
      await newClass.save();

      return res.status(201).json({
        status: "success",
        message: "Đã tìm thấy giảng viên phù hợp cho lớp học của bạn",
        data: {
          class: newClass,
          tutor: availableTutor
        }
      });
    } else {
      // Tạo lớp mới với trạng thái pending
      const newClass = new Class({
        subject,
        grade,
        studentId,
        time,
        day: dayArray,
        startDate,
        endDate,
        requirements,
        status: "pending"
      });

      await newClass.save();

      // Tìm các thời gian thay thế
      const alternativeTimes = await findAlternativeTimes(subject, grade, dayArray);

      if (alternativeTimes.length > 0) {
        // Cập nhật lớp với các thời gian thay thế
        newClass.alternativeTimes = alternativeTimes;
        newClass.status = "waiting";
        await newClass.save();

        return res.status(201).json({
          status: "success",
          message: "Không tìm thấy giảng viên phù hợp cho thời gian bạn chọn. Vui lòng xem xét các thời gian thay thế.",
          data: {
            class: newClass,
            alternativeTimes
          }
        });
      } else {
        // Không tìm thấy giảng viên và không có thời gian thay thế
        return res.status(201).json({
          status: "success",
          message: "Không tìm thấy giảng viên phù hợp. Vui lòng thử lại sau hoặc chọn thời gian khác.",
          data: {
            class: newClass
          }
        });
      }
    }
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo lớp học: " + error.message,
    });
  }
};

// Hàm kiểm tra xung đột lịch của giảng viên
const checkTutorAvailability = async (tutors, time, days, startDate, endDate) => {
  try {
    for (const tutor of tutors) {
      // Kiểm tra các session hiện có của giảng viên
      let hasConflict = false;

      for (const day of days) {
        const conflictingSessions = await Session.find({
          tutorId: tutor._id,
          day: {$in: [day]}, // Kiểm tra xem ngày này có trong mảng day không
          time: time,
          $or: [
            // Kiểm tra các trường hợp xung đột:
            // 1. Session hiện tại chồng lên session mới hoàn toàn
            {
              startDate: {$lte: startDate},
              endDate: {$gte: endDate}
            },
            // 2. Session mới chồng lên session hiện tại hoàn toàn
            {
              startDate: {$gte: startDate},
              endDate: {$lte: endDate}
            },
            // 3. Ngày bắt đầu của session hiện tại nằm trong khoảng thời gian session mới
            {
              startDate: {$gte: startDate, $lte: endDate}
            },
            // 4. Ngày kết thúc của session hiện tại nằm trong khoảng thời gian session mới
            {
              endDate: {$gte: startDate, $lte: endDate}
            }
          ]
        });

        if (conflictingSessions.length > 0) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        // Nếu không có xung đột lịch, giảng viên này có thể dạy
        return tutor;
      }
    }

    // Không tìm thấy giảng viên phù hợp
    return null;
  } catch (error) {
    console.error("Lỗi khi kiểm tra lịch giảng viên:", error);
    return null;
  }
};

// Hàm tìm giảng viên phù hợp
const findAvailableTutors = async (subject, grade, time, days) => {
  try {
    // Tìm giảng viên có thể dạy môn học và cấp độ này
    const tutors = await Tutor.find({
      "subjects": {
        $elemMatch: {
          "subject": subject,
          "grades": grade
        }
      }
    });

    // Lọc giảng viên có lịch trống vào thời gian yêu cầu
    const availableTutors = [];

    for (const tutor of tutors) {
      let isAvailable = true;

      // Kiểm tra từng ngày trong danh sách ngày yêu cầu
      for (const day of days) {
        const bookedSlots = tutor.schedule && tutor.schedule[day] ? tutor.schedule[day] : [];

        if (bookedSlots.includes(time)) {
          isAvailable = false;
          break;
        }
      }

      if (isAvailable) {
        availableTutors.push(tutor);
      }
    }

    return availableTutors;
  } catch (error) {
    console.error("Lỗi khi tìm giảng viên phù hợp:", error);
    return [];
  }
};

// Hàm tìm các thời gian thay thế
const findAlternativeTimes = async (subject, grade, preferredDays) => {
  try {
    const availableSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00"
    ];

    const allDays = [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    ];

    const alternativeTimes = [];

    // Tìm giảng viên có thể dạy môn học và cấp độ này
    const tutors = await Tutor.find({
      "subjects": {
        $elemMatch: {
          "subject": subject,
          "grades": grade
        }
      }
    });

    // Kiểm tra từng giảng viên
    for (const tutor of tutors) {
      // Kiểm tra các khung giờ khác
      for (const time of availableSlots) {
        // Kiểm tra các ngày đã chọn trước
        for (const day of preferredDays) {
          const bookedSlots = tutor.schedule && tutor.schedule[day] ? tutor.schedule[day] : [];

          if (!bookedSlots.includes(time)) {
            // Thêm vào danh sách thời gian thay thế
            const existingAlternative = alternativeTimes.find(
              alt => alt.time === time && alt.days.includes(day) && alt.tutorId.equals(tutor._id)
            );

            if (existingAlternative) {
              // Nếu đã có thời gian này với giảng viên này, thêm ngày vào
              if (!existingAlternative.days.includes(day)) {
                existingAlternative.days.push(day);
              }
            } else {
              // Thêm mới
              alternativeTimes.push({
                time,
                days: [day],
                tutorId: tutor._id
              });
            }
          }
        }

        // Kiểm tra các ngày khác
        const otherDays = allDays.filter(day => !preferredDays.includes(day));

        for (const day of otherDays) {
          const bookedSlots = tutor.schedule && tutor.schedule[day] ? tutor.schedule[day] : [];

          if (!bookedSlots.includes(time)) {
            // Thêm vào danh sách thời gian thay thế
            const existingAlternative = alternativeTimes.find(
              alt => alt.time === time && alt.days.includes(day) && alt.tutorId.equals(tutor._id)
            );

            if (existingAlternative) {
              // Nếu đã có thời gian này với giảng viên này, thêm ngày vào
              if (!existingAlternative.days.includes(day)) {
                existingAlternative.days.push(day);
              }
            } else {
              // Thêm mới
              alternativeTimes.push({
                time,
                days: [day],
                tutorId: tutor._id
              });
            }
          }
        }
      }
    }

    // Giới hạn số lượng thời gian thay thế
    return alternativeTimes.slice(0, 5);
  } catch (error) {
    console.error("Lỗi khi tìm thời gian thay thế:", error);
    return [];
  }
};

// Lấy danh sách lớp học
const getClasses = async (req, res) => {
  try {
    const role = req.user.role;
    if (role === "tutor") {
      return getClassesOfTutor(req, res);
    }
    return getClassesOfStudent(req, res);
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lớp học: " + error.message,
    });
  }
};

// Lấy danh sách lớp học của giảng viên
const getClassesOfTutor = async (req, res) => {
  try {
    const userId = req.user._id;
    const tutor = await Tutor.findOne({userId});

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin giảng viên",
      });
    }

    const classes = await Class.find({tutorId: tutor._id})
      .populate("studentId", "name email avatar")
      .populate("sessionId");

    res.json({
      status: "success",
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lớp học: " + error.message,
    });
  }
};

// Lấy danh sách lớp học của học viên
const getClassesOfStudent = async (req, res) => {
  try {
    const studentId = req.user._id;
    const classes = await Class.find({studentId})
      .populate({
        path: "tutorId",
        populate: {path: "userId", select: "name email avatar"}
      })
      .populate("sessionId");

    res.json({
      status: "success",
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách lớp học: " + error.message,
    });
  }
};

// Lấy thông tin chi tiết lớp học
const getClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const classInfo = await Class.findById(classId)
      .populate({
        path: "tutorId",
        populate: {path: "userId", select: "name email avatar"}
      })
      .populate("studentId", "name email avatar")
      .populate("sessionId")
      .populate("bookingId");

    if (!classInfo) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin lớp học",
      });
    }

    res.json({
      status: "success",
      data: classInfo,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thông tin lớp học: " + error.message,
    });
  }
};

// Chọn thời gian thay thế
const selectAlternativeTime = async (req, res) => {
  try {
    const classId = req.params.id;
    const {alternativeIndex} = req.body;

    const classInfo = await Class.findById(classId);

    if (!classInfo) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin lớp học",
      });
    }

    // Kiểm tra quyền truy cập
    if (classInfo.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Kiểm tra index hợp lệ
    if (!classInfo.alternativeTimes || alternativeIndex >= classInfo.alternativeTimes.length) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian thay thế không hợp lệ",
      });
    }

    const selectedAlternative = classInfo.alternativeTimes[alternativeIndex];

    // Cập nhật lớp học với thời gian đã chọn
    classInfo.time = selectedAlternative.time;
    classInfo.day = selectedAlternative.days;
    classInfo.tutorId = selectedAlternative.tutorId;
    classInfo.status = "matched";
    classInfo.alternativeTimes = [];

    await classInfo.save();

    // Tạo booking tương ứng
    const booking = new Booking({
      tutorId: selectedAlternative.tutorId,
      userId: classInfo.studentId,
      time: selectedAlternative.time,
      day: selectedAlternative.days,
      startDate: classInfo.startDate,
      endDate: classInfo.endDate,
      requirements: classInfo.requirements,
      status: "accepted"
    });

    await booking.save();

    // Cập nhật lớp với booking ID
    classInfo.bookingId = booking._id;
    await classInfo.save();

    res.json({
      status: "success",
      message: "Đã chọn thời gian thay thế thành công",
      data: classInfo
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi chọn thời gian thay thế: " + error.message,
    });
  }
};

// Hủy lớp học
const cancelClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const classInfo = await Class.findById(classId);

    if (!classInfo) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin lớp học",
      });
    }

    // Kiểm tra quyền truy cập
    if (classInfo.studentId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Cập nhật trạng thái lớp học
    classInfo.status = "canceled";
    await classInfo.save();

    // Nếu đã có booking, hủy booking
    if (classInfo.bookingId) {
      await Booking.findByIdAndUpdate(classInfo.bookingId, {
        status: "canceled"
      });
    }

    res.json({
      status: "success",
      message: "Đã hủy lớp học thành công",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi hủy lớp học: " + error.message,
    });
  }
};

module.exports = {
  createClass,
  getClasses,
  getClass,
  selectAlternativeTime,
  cancelClass
};