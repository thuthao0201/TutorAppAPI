const Class = require("../models/class.model");
const Tutor = require("../models/tutor.model");
const Booking = require("../models/booking.model");
const Session = require("../models/session.model");
const User = require("../models/user.model");

// Tạo lớp mới từ học viên
const createClass = async (req, res) => {
  try {
    const studentId = req.user._id;
    const {
      subject,
      grade,
      time,
      day,
      startDate,
      endDate,
      requirements,
      expectedPrice,
    } = req.body;

    // Kiểm tra thời gian hợp lệ
    const availableSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00",
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
      subjects: {
        $elemMatch: {
          subject: subject,
          grades: grade,
        },
      },
    });

    if (tutors.length === 0) {
      return res.status(201).json({
        status: "fail",
        message:
          "Không tìm thấy giảng viên dạy môn học này. Vui lòng thử môn học khác.",
      });
    }

    // Kiểm tra xung đột lịch giảng viên và giá cả
    const availableTutor = await checkTutorAvailability(
      tutors,
      studentId,
      time,
      dayArray,
      startDate,
      endDate,
      expectedPrice
    );

    if (availableTutor) {
      // Tạo session mới cho lớp học
      const newSession = new Session({
        tutorId: availableTutor._id,
        studentId: studentId,
        time,
        day: dayArray,
        startDate,
        endDate,
        subject,
        grade,
        sessionPrice: availableTutor.sessionPrice,
        status: "active",
      });

      await newSession.save();

      // Tạo lớp học với trạng thái matched và gắn session
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
        expectedPrice: expectedPrice || 0,
        sessionId: newSession._id,
        status: "matched",
      });

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

      // Lấy tất cả các ngày trong khoảng thời gian đã chọn
      const requestedDates = getWeekdayDatesInRange(
        startDate,
        endDate,
        dayArray
      );

      // Trừ tiền từ tài khoản học viên
      const student = await User.findById(studentId);
      if (student.balance < expectedPrice * requestedDates.length) {
        return res.status(200).json({
          status: "fail",
          message: "Số dư tài khoản không đủ để thanh toán lớp học này",
        });
      }
      student.balance -= expectedPrice * requestedDates.length;
      await student.save();

      const tutorAvailable = await Tutor.findById(availableTutor._id);
      if (!tutorAvailable) {
        return res.status(404).json({
          status: "fail",
          message: "Không tìm thấy thông tin giảng viên",
        });
      }

      const userTutor = await User.findById(tutorAvailable.userId);
      if (!userTutor) {
        return res.status(404).json({
          status: "fail",
          message: "Không tìm thấy thông tin người dùng giảng viên",
        });
      }

      userTutor.pendingBalance += expectedPrice * requestedDates.length;
      await userTutor.save();
      await newClass.save();

      return res.status(201).json({
        status: "success",
        message: "Đã tìm thấy giảng viên phù hợp cho lớp học của bạn",
        data: {
          class: newClass,
          tutor: availableTutor,
        },
      });
    } else {
      // Không tạo lớp khi không tìm thấy giảng viên phù hợp
      // Thay vào đó, tìm các thời gian thay thế và trả về
      const alternativeTimes = await findAlternativeTimes(
        subject,
        grade,
        dayArray,
        expectedPrice,
        studentId,
        time
      );

      if (alternativeTimes.length > 0) {
        return res.status(200).json({
          status: "fail",
          message:
            "Không tìm thấy giảng viên phù hợp cho thời gian bạn chọn. Vui lòng xem xét các thời gian thay thế.",
          data: {
            alternativeTimes,
          },
        });
      } else {
        // Không tìm thấy giảng viên và không có thời gian thay thế
        return res.status(200).json({
          status: "fail",
          message:
            "Không tìm thấy giảng viên phù hợp. Vui lòng thử lại sau hoặc chọn thời gian khác.",
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
const checkTutorAvailability = async (
  tutors,
  studentId,
  time,
  days,
  startDate,
  endDate,
  expectedPrice
) => {
  try {
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

    // Get actual calendar dates for the requested class
    const requestedDates = getWeekdayDatesInRange(startDate, endDate, days);

    // If no specific dates match the criteria, there's nothing to book
    if (requestedDates.length === 0) {
      return null;
    }

    // Filter tutors based on price first if expectedPrice is set
    let eligibleTutors = tutors;
    if (expectedPrice > 0) {
      eligibleTutors = tutors.filter(
        (tutor) => tutor.sessionPrice <= expectedPrice
      );
    }

    // No tutors meet the price criteria
    if (eligibleTutors.length === 0) {
      return null;
    }

    // For each tutor, check if they have available schedule and no conflicts
    const availableTutors = [];

    for (const tutor of eligibleTutors) {
      // Check if tutor's availableSchedule includes the requested days and time
      const hasAvailableSchedule = days.every((day) => {
        const daySchedule = tutor.availableSchedule.find(
          (schedule) => schedule.day === day
        );
        return daySchedule && daySchedule.timeSlots.includes(time);
      });

      if (!hasAvailableSchedule) {
        continue;
      }

      // Find all sessions that might conflict for this tutor
      const potentialConflictSessions = await Session.find({
        $or: [{ tutorId: tutor._id }, { studentId: studentId }],
        time: time,
        status: "active",
      });

      // Check for actual conflicts on specific dates
      let hasConflict = false;
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
          break;
        }
      }

      // If no conflicts, add to available tutors
      if (!hasConflict) {
        availableTutors.push(tutor);
      }
    }
    console.log(availableTutors);

    // Sort tutors by trustScore (highest first)
    availableTutors.sort((a, b) => b.trustScore - a.trustScore);

    // Return the best matching tutor (highest trustScore)
    return availableTutors.length > 0 ? availableTutors[0] : null;
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
      subjects: {
        $elemMatch: {
          subject: subject,
          grades: grade,
        },
      },
    });

    // Lọc giảng viên có lịch trống vào thời gian yêu cầu
    const availableTutors = [];

    for (const tutor of tutors) {
      let isAvailable = true;

      // Kiểm tra từng ngày trong danh sách ngày yêu cầu
      for (const day of days) {
        const bookedSlots =
          tutor.schedule && tutor.schedule[day] ? tutor.schedule[day] : [];

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
const findAlternativeTimes = async (
  subject,
  grade,
  preferredDays,
  expectedPrice,
  studentId,
  preferredTime
) => {
  try {
    const availableSlots = [
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

    // Cấu trúc dữ liệu cho các thời gian thay thế, phân loại theo mức độ ưu tiên
    const alternatives = {
      sameDayDifferentTime: [], // Cùng ngày, khác ca
      sameTimeDifferentDay: [], // Cùng ca, khác ngày
      sameDayTimeHigherPrice: [], // Cùng ngày và ca nhưng giá cao hơn
      otherOptions: [], // Các lựa chọn khác
    };

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

    // Tìm giảng viên có thể dạy môn học và cấp độ này
    const tutors = await Tutor.find({
      subjects: {
        $elemMatch: {
          subject: subject,
          grades: grade,
        },
      },
    }).populate("userId", "name email avatar");

    // Không lọc giảng viên theo giá ngay từ đầu
    const eligibleTutors = tutors;

    // Lấy tất cả các session hiện tại của học viên để kiểm tra xung đột
    const studentSessions = await Session.find({
      studentId: studentId,
      status: "active",
    });

    // Kiểm tra từng giảng viên
    for (const tutor of eligibleTutors) {
      // Tạo danh sách các khung giờ và ngày mà giảng viên này có thể dạy dựa trên availableSchedule
      const tutorAvailableSlots = [];

      for (const day of allDays) {
        const daySchedule = tutor.availableSchedule.find(
          (schedule) => schedule.day === day
        );
        if (daySchedule) {
          for (const timeSlot of daySchedule.timeSlots) {
            tutorAvailableSlots.push({ day, time: timeSlot });
          }
        }
      }

      // Lấy tất cả các session hiện tại của giảng viên để kiểm tra xung đột
      const tutorSessions = await Session.find({
        tutorId: tutor._id,
        status: "active",
      });

      // Kiểm tra từng khung giờ có sẵn
      for (const slot of tutorAvailableSlots) {
        // Đánh dấu slot là ngày ưu tiên và ca ưu tiên
        const isPreferredDay = preferredDays.includes(slot.day);
        const isPreferredTime = slot.time === preferredTime;
        const isPriceWithinBudget =
          expectedPrice === 0 || tutor.sessionPrice <= expectedPrice;

        // Kiểm tra xem slot này có xung đột với session của giảng viên không
        let hasTutorConflict = false;
        for (const session of tutorSessions) {
          if (session.time === slot.time && session.day.includes(slot.day)) {
            hasTutorConflict = true;
            break;
          }
        }

        // Kiểm tra xem slot này có xung đột với session của học viên không
        let hasStudentConflict = false;
        for (const session of studentSessions) {
          if (session.time === slot.time && session.day.includes(slot.day)) {
            hasStudentConflict = true;
            break;
          }
        }

        // Thêm vào danh sách thời gian thay thế nếu không có xung đột cho cả giảng viên và học viên
        if (!hasTutorConflict && !hasStudentConflict) {
          const alternativeOption = {
            time: slot.time,
            days: [slot.day],
            tutorId: tutor._id,
            sessionPrice: tutor.sessionPrice,
            tutorName: tutor.userId?.name || "Gia sư",
            isPreferredDay,
            isPreferredTime,
            isPriceWithinBudget,
            trustScore: tutor.trustScore || 0,
          };

          // Phân loại thời gian thay thế theo mức độ ưu tiên
          if (isPreferredDay && isPreferredTime && !isPriceWithinBudget) {
            // Cùng ngày và ca nhưng giá cao hơn
            alternatives.sameDayTimeHigherPrice.push(alternativeOption);
          } else if (isPreferredDay && !isPreferredTime) {
            // Cùng ngày, khác ca
            alternatives.sameDayDifferentTime.push(alternativeOption);
          } else if (!isPreferredDay && isPreferredTime) {
            // Cùng ca, khác ngày
            alternatives.sameTimeDifferentDay.push(alternativeOption);
          } else {
            // Các lựa chọn khác
            alternatives.otherOptions.push(alternativeOption);
          }
        }
      }
    }

    // Gộp các lựa chọn từ các danh sách theo thứ tự ưu tiên
    let combinedAlternatives = [];

    // Hàm kết hợp các slot có cùng thời gian và cùng giảng viên
    const combineSlots = (altList) => {
      const combined = [];

      for (const alt of altList) {
        const existingIndex = combined.findIndex(
          (item) =>
            item.time === alt.time &&
            item.tutorId.toString() === alt.tutorId.toString()
        );

        if (existingIndex !== -1) {
          // Kết hợp ngày nếu đã có slot với cùng giảng viên và cùng giờ
          for (const day of alt.days) {
            if (!combined[existingIndex].days.includes(day)) {
              combined[existingIndex].days.push(day);
            }
          }
        } else {
          combined.push({ ...alt });
        }
      }

      return combined;
    };

    // Sắp xếp từng danh sách và kết hợp các slot
    // 1. Ưu tiên cùng ngày, khác ca
    alternatives.sameDayDifferentTime.sort(
      (a, b) => a.sessionPrice - b.sessionPrice
    );
    combinedAlternatives = [
      ...combinedAlternatives,
      ...combineSlots(alternatives.sameDayDifferentTime),
    ];

    // 2. Cùng ca, khác ngày
    alternatives.sameTimeDifferentDay.sort(
      (a, b) => a.sessionPrice - b.sessionPrice
    );
    combinedAlternatives = [
      ...combinedAlternatives,
      ...combineSlots(alternatives.sameTimeDifferentDay),
    ];

    // 3. Cùng ngày và ca nhưng giá cao hơn
    alternatives.sameDayTimeHigherPrice.sort(
      (a, b) => a.sessionPrice - b.sessionPrice
    );
    combinedAlternatives = [
      ...combinedAlternatives,
      ...combineSlots(alternatives.sameDayTimeHigherPrice),
    ];

    // 4. Các lựa chọn khác
    alternatives.otherOptions.sort((a, b) => {
      // Ưu tiên theo giá, sau đó theo trustScore
      if (a.sessionPrice !== b.sessionPrice) {
        return a.sessionPrice - b.sessionPrice;
      }
      return b.trustScore - a.trustScore;
    });
    combinedAlternatives = [
      ...combinedAlternatives,
      ...combineSlots(alternatives.otherOptions),
    ];

    // Giới hạn số lượng thời gian thay thế
    return combinedAlternatives.slice(0, 10);
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
    const tutor = await Tutor.findOne({ userId });

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin giảng viên",
      });
    }

    const classes = await Class.find({ tutorId: tutor._id })
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
    const classes = await Class.find({ studentId })
      .populate({
        path: "studentId",
        select: "name email avatar",
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
        populate: { path: "userId", select: "name email avatar" },
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
    const { alternativeIndex } = req.body;

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
    if (
      !classInfo.alternativeTimes ||
      alternativeIndex >= classInfo.alternativeTimes.length
    ) {
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
      status: "accepted",
    });

    await booking.save();

    // Cập nhật lớp với booking ID
    classInfo.bookingId = booking._id;
    await classInfo.save();

    res.json({
      status: "success",
      message: "Đã chọn thời gian thay thế thành công",
      data: classInfo,
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
    if (
      classInfo.studentId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
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
        status: "canceled",
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
  cancelClass,
};
