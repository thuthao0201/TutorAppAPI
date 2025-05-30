const Post = require("../models/post.model");
const Tutor = require("../models/tutor.model");
const User = require("../models/user.model");
const Class = require("../models/class.model");

// Tạo bài đăng mới từ học viên
const createPost = async (req, res) => {
  try {
    const studentId = req.user._id;
    const {
      subject,
      grade,
      timeSlot,
      day,
      startDate,
      endDate,
      requirements,
      expectedPrice,
    } = req.body;

    console.log("Received data:", req.body);

    // Kiểm tra thời gian hợp lệ
    const availableSlots = [
      "7:00-9:00",
      "9:30-11:30",
      "13:00-15:00",
      "15:30-17:30",
      "19:00-21:00",
    ];

    if (!availableSlots.includes(timeSlot)) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian học không hợp lệ. Vui lòng chọn ca học hợp lệ",
      });
    }

    // Kiểm tra ngày hợp lệ
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    if (!validDays.includes(day)) {
      return res.status(400).json({
        status: "fail",
        message: "Ngày học không hợp lệ. Vui lòng chọn ngày học hợp lệ",
      });
    }

    // Tìm giảng viên có thể dạy môn học này
    const tutors = await Tutor.find({
      subjects: {
        $elemMatch: {
          name: subject,
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

    // Lấy danh sách giảng viên phù hợp và xếp hạng
    const eligibleTutors = await findEligibleTutors(
      tutors,
      studentId,
      timeSlot,
      day,
      startDate,
      endDate,
      expectedPrice
    );

    if (eligibleTutors.length === 0) {
      // Không tìm thấy giảng viên phù hợp, tìm thời gian thay thế
      const alternativeTimes = await findAlternativeTimes(
        subject,
        grade,
        day,
        expectedPrice,
        studentId,
        timeSlot
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
          status: "success",
          message:
            "Không tìm thấy giảng viên phù hợp. Vui lòng thử lại sau hoặc chọn thời gian khác.",
        });
      }
    }

    // Tạo post với danh sách giảng viên phù hợp
    const newPost = new Post({
      subject,
      grade,
      studentId,
      timeSlot,
      day,
      startDate,
      endDate,
      requirements,
      expectedPrice: expectedPrice || 0,
      status: "waiting_tutor_confirmation",
      eligibleTutors: eligibleTutors.map((tutor) => ({
        tutorId: tutor._id,
        score: tutor.score || 0,
      })),
      currentAssignedTutor: eligibleTutors[0]._id, // Assign to best match tutor
      assignedAt: new Date(),
      responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours deadline
    });

    await newPost.save();

    // Gửi thông báo cho giảng viên được chọn
    // TODO: Implement notification system

    return res.status(201).json({
      status: "success",
      message: "Đã tạo bài đăng và gửi yêu cầu đến giảng viên phù hợp",
      data: {
        post: newPost,
        assignedTutor: eligibleTutors[0],
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo bài đăng: " + error.message,
    });
  }
};

// Hàm tìm và xếp hạng giảng viên phù hợp
const findEligibleTutors = async (
  tutors,
  studentId,
  timeSlot,
  day,
  startDate,
  endDate,
  expectedPrice
) => {
  try {
    // Filter tutors based on price first if expectedPrice is set
    let eligibleTutors = tutors;
    if (expectedPrice > 0) {
      eligibleTutors = tutors.filter(
        (tutor) => tutor.classPrice <= expectedPrice
      );
    }

    // No tutors meet the price criteria
    if (eligibleTutors.length === 0) {
      return [];
    }

    // For each tutor, check if they have available schedule and no conflicts
    const availableTutors = [];

    for (const tutor of eligibleTutors) {
      // Check if tutor's availableSchedule includes the requested day and time
      const daySchedule = tutor.availableSchedule.find(
        (schedule) => schedule.day === day
      );
      const hasAvailableSchedule =
        daySchedule && daySchedule.timeSlots.includes(timeSlot);

      if (!hasAvailableSchedule) {
        continue;
      }

      // Find all classes that might conflict for this tutor
      const potentialConflictClasses = await Class.find({
        tutorId: tutor._id,
        timeSlot: timeSlot,
        day: day,
        status: "active",
        $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
      });

      // Check for conflicts with student's classes
      const studentConflictClasses = await Class.find({
        studentId: studentId,
        timeSlot: timeSlot,
        day: day,
        status: "active",
        $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
      });

      // If no conflicts, add to available tutors with a calculated score
      if (
        potentialConflictClasses.length === 0 &&
        studentConflictClasses.length === 0
      ) {
        // Calculate a score for this tutor based on multiple factors
        const score = calculateTutorScore(tutor, expectedPrice);

        // Add to available tutors
        availableTutors.push({
          ...tutor.toObject(),
          score: score,
        });
      }
    }

    // Sort tutors by score (highest first)
    return availableTutors.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Lỗi khi tìm giảng viên phù hợp:", error);
    return [];
  }
};

// Hàm tính điểm xếp hạng cho giảng viên
const calculateTutorScore = (tutor, expectedPrice) => {
  let score = 0;

  // Factor 1: Trust score (0-10)
  score += tutor.trustScore || 0;

  // Factor 2: Price proximity to expected price (0-5)
  if (expectedPrice > 0) {
    const priceDifference = expectedPrice - tutor.classPrice;
    if (priceDifference >= 0) {
      // Price is equal or lower than expected
      score += 5;
    } else {
      // Price is higher than expected
      const priceScore = Math.max(0, 5 + (priceDifference / expectedPrice) * 5);
      score += priceScore;
    }
  } else {
    // No price preference, favor lower price
    score += 2.5;
  }

  // Factor 3: Experience (0-3)
  score += Math.min(3, tutor.experience || 0);

  // Factor 4: Response rate (0-2)
  score += (tutor.responseRate || 0) * 2;

  return score;
};

// Hàm tính số buổi học trong khoảng thời gian
const getNumberOfClassesInDateRange = (startDate, endDate, dayOfWeek) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

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

  // Convert weekday string to day number
  const dayNumber = dayMapping[dayOfWeek.toLowerCase()];

  // Clone the start date
  const current = new Date(start);

  // Iterate through each date in the range
  while (current <= end) {
    if (current.getDay() === dayNumber) {
      count++;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return count;
};

// Hàm tìm các thời gian thay thế
const findAlternativeTimes = async (
  subject,
  grade,
  preferredDay,
  expectedPrice,
  studentId,
  preferredTimeSlot
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

    // Tìm giảng viên có thể dạy môn học và cấp độ này
    const tutors = await Tutor.find({
      subjects: {
        $elemMatch: {
          name: subject,
          grades: grade,
        },
      },
    }).populate("userId");

    // Không lọc giảng viên theo giá ngay từ đầu
    const eligibleTutors = tutors;

    // Lấy tất cả các class hiện tại của học viên để kiểm tra xung đột
    const studentClasses = await Class.find({
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
            tutorAvailableSlots.push({ day, timeSlot });
          }
        }
      }

      // Lấy tất cả các class hiện tại của giảng viên để kiểm tra xung đột
      const tutorClasses = await Class.find({
        tutorId: tutor._id,
        status: "active",
      });

      // Kiểm tra từng khung giờ có sẵn
      for (const slot of tutorAvailableSlots) {
        // Đánh dấu slot là ngày ưu tiên và ca ưu tiên
        const isPreferredDay = slot.day === preferredDay;
        const isPreferredTime = slot.timeSlot === preferredTimeSlot;
        const isPriceWithinBudget =
          expectedPrice === 0 || tutor.classPrice <= expectedPrice;

        // Kiểm tra xem slot này có xung đột với class của giảng viên không
        let hasTutorConflict = false;
        for (const classItem of tutorClasses) {
          if (
            classItem.timeSlot === slot.timeSlot &&
            classItem.day === slot.day
          ) {
            hasTutorConflict = true;
            break;
          }
        }

        // Kiểm tra xem slot này có xung đột với class của học viên không
        let hasStudentConflict = false;
        for (const classItem of studentClasses) {
          if (
            classItem.timeSlot === slot.timeSlot &&
            classItem.day === slot.day
          ) {
            hasStudentConflict = true;
            break;
          }
        }

        // Thêm vào danh sách thời gian thay thế nếu không có xung đột cho cả giảng viên và học viên
        if (!hasTutorConflict && !hasStudentConflict) {
          const alternativeOption = {
            timeSlot: slot.timeSlot,
            day: slot.day,
            tutorId: tutor._id,
            classPrice: tutor.classPrice,
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

    // Sắp xếp từng danh sách
    // 1. Ưu tiên cùng ngày, khác ca
    alternatives.sameDayDifferentTime.sort(
      (a, b) => a.classPrice - b.classPrice
    );
    combinedAlternatives = [
      ...combinedAlternatives,
      ...alternatives.sameDayDifferentTime,
    ];

    // 2. Cùng ca, khác ngày
    alternatives.sameTimeDifferentDay.sort(
      (a, b) => a.classPrice - b.classPrice
    );
    combinedAlternatives = [
      ...combinedAlternatives,
      ...alternatives.sameTimeDifferentDay,
    ];

    // 3. Cùng ngày và ca nhưng giá cao hơn
    alternatives.sameDayTimeHigherPrice.sort(
      (a, b) => a.classPrice - b.classPrice
    );
    combinedAlternatives = [
      ...combinedAlternatives,
      ...alternatives.sameDayTimeHigherPrice,
    ];

    // 4. Các lựa chọn khác
    alternatives.otherOptions.sort((a, b) => {
      // Ưu tiên theo giá, sau đó theo trustScore
      if (a.classPrice !== b.classPrice) {
        return a.classPrice - b.classPrice;
      }
      return b.trustScore - a.trustScore;
    });
    combinedAlternatives = [
      ...combinedAlternatives,
      ...alternatives.otherOptions,
    ];

    // Giới hạn số lượng thời gian thay thế
    return combinedAlternatives.slice(0, 10);
  } catch (error) {
    console.error("Lỗi khi tìm thời gian thay thế:", error);
    return [];
  }
};

// Giảng viên chấp nhận bài đăng
const acceptPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const tutor = await Tutor.findOne({ userId }).populate("userId");
    const post = await Post.findById(postId);
    const student = await User.findById(post.studentId);

    if (!post) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin bài đăng",
      });
    }
    console.log("Post data:", post);

    // Check if this tutor is currently assigned to this post
    if (
      !post.currentAssignedTutor ||
      post.currentAssignedTutor?.toString() !== tutor._id.toString()
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không được chỉ định cho bài đăng này",
      });
    }

    // Check if post is still waiting for confirmation
    if (post.status !== "waiting_tutor_confirmation") {
      return res.status(400).json({
        status: "fail",
        message: "Bài đăng này đã được xử lý",
      });
    }

    if (!student || !tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin học viên hoặc giảng viên",
      });
    }

    // Create a new class
    const newClass = new Class({
      tutorId: tutor._id,
      studentId: post.studentId,
      timeSlot: post.timeSlot,
      day: post.day,
      startDate: post.startDate,
      endDate: post.endDate,
      status: "active",
      subject: post.subject,
      grade: post.grade,
      requirements: post.requirements,
      classPrice: tutor.classPrice,
      joinUrl:
        "https://meet.jit.si/" + Math.random().toString(36).substring(2, 15),
    });

    await newClass.save();

    // Update post status to matched and add classId
    post.status = "matched";
    post.classId = newClass._id;
    await post.save();

    // Tính số buổi học trong khoảng thời gian
    const totalClasses = getNumberOfClassesInDateRange(
      post.startDate,
      post.endDate,
      post.day
    );

    // Trừ tiền từ tài khoản học viên
    if (student.balance < tutor.classPrice * totalClasses) {
      return res.status(400).json({
        status: "fail",
        message: "Số dư tài khoản học viên không đủ để thanh toán lớp học này",
      });
    }

    student.balance -= tutor.classPrice * totalClasses;
    await student.save();

    // Cập nhật pending balance cho giảng viên
    const userTutor = await User.findById(tutor.userId._id);
    userTutor.pendingBalance += tutor.classPrice * totalClasses;
    await userTutor.save();

    // Cập nhật điểm trust score cho giảng viên (bonuses for accepting)
    tutor.trustScore = Math.min(100, (tutor.trustScore || 0) + 1);
    tutor.responseRate = calculateNewResponseRate(
      tutor.responseRate || 0,
      true
    );
    await tutor.save();

    res.json({
      status: "success",
      message: "Đã nhận lớp thành công",
      data: {
        class: newClass,
      },
    });
  } catch (error) {
    console.log("Error accepting post:", error);

    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi nhận lớp: " + error.message,
    });
  }
};

// Giảng viên từ chối bài đăng
const rejectPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { reason } = req.body;
    const tutor = await Tutor.findOne({ userId: req.user._id });
    const tutorId = tutor._id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin bài đăng",
      });
    }

    // Check if this tutor is currently assigned to this post
    if (
      !post.currentAssignedTutor ||
      post.currentAssignedTutor.toString() !== tutorId.toString()
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không được chỉ định cho bài đăng này",
      });
    }

    // Check if post is still waiting for confirmation
    if (post.status !== "waiting_tutor_confirmation") {
      return res.status(400).json({
        status: "fail",
        message: "Bài đăng này đã được xử lý",
      });
    }

    // Add current tutor to rejected tutors list
    post.rejectedTutors.push({
      tutorId: tutorId,
      reason: reason || "Không có lý do",
      rejectedAt: new Date(),
    });

    // Find next eligible tutor that hasn't rejected the post
    const nextTutor = post.eligibleTutors.find(
      (eligible) =>
        eligible.tutorId.toString() !== tutorId.toString() &&
        !post.rejectedTutors.some(
          (rejected) =>
            rejected.tutorId.toString() === eligible.tutorId.toString()
        )
    );

    // If there's a next tutor, assign them
    if (nextTutor) {
      post.currentAssignedTutor = nextTutor.tutorId;
      post.assignedAt = new Date();
      post.responseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours deadline
      await post.save();

      // TODO: Send notification to the next tutor

      // Update tutor's trust score and response rate
      const tutor = await Tutor.findById(tutorId);

      if (tutor) {
        // Decrease trust score slightly for rejecting
        tutor.trustScore = Math.max(0, (tutor.trustScore || 0) - 0.1);
        tutor.responseRate = calculateNewResponseRate(
          tutor.responseRate || 0,
          false
        );
        await tutor.save();
      }

      res.json({
        status: "success",
        message: "Đã từ chối lớp và chuyển yêu cầu đến giảng viên tiếp theo",
      });
    } else {
      // No more eligible tutors
      post.status = "pending"; // Mark as pending to find alternates
      await post.save();

      // Update tutor's trust score and response rate
      const tutor = await Tutor.findById(tutorId);

      if (tutor) {
        // Decrease trust score slightly for rejecting
        tutor.trustScore = Math.max(0, (tutor.trustScore || 0) - 0.1);
        tutor.responseRate = calculateNewResponseRate(
          tutor.responseRate || 0,
          false
        );
        await tutor.save();
      }

      // Find alternative times
      const alternativeTimes = await findAlternativeTimes(
        post.subject,
        post.grade,
        post.day,
        post.expectedPrice,
        post.studentId,
        post.timeSlot
      );

      // Notify student that no tutors are available
      res.json({
        status: "success",
        message: "Đã từ chối lớp. Không còn giảng viên phù hợp nào khác.",
        data: {
          alternativeTimes:
            alternativeTimes.length > 0 ? alternativeTimes : undefined,
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi từ chối lớp: " + error.message,
    });
  }
};

// Cập nhật tỉ lệ phản hồi của giảng viên
const calculateNewResponseRate = (currentRate, didAccept) => {
  const weight = 0.8; // Weight for recent responses
  return currentRate * weight + (didAccept ? 1 : 0) * (1 - weight);
};

// Check for expired tutor response deadlines
const checkExpiredRequests = async () => {
  try {
    const expiredPosts = await Post.find({
      status: "waiting_tutor_confirmation",
      responseDeadline: { $lt: new Date() },
    });

    for (const post of expiredPosts) {
      // Mark current tutor as rejected for not responding
      post.rejectedTutors.push({
        tutorId: post.currentAssignedTutor,
        reason: "Không phản hồi trong thời gian quy định",
        rejectedAt: new Date(),
      });

      // Find next eligible tutor
      const nextTutor = post.eligibleTutors.find(
        (eligible) =>
          eligible.tutorId.toString() !==
            post.currentAssignedTutor.toString() &&
          !post.rejectedTutors.some(
            (rejected) =>
              rejected.tutorId.toString() === eligible.tutorId.toString()
          )
      );

      // If there's a next tutor, assign them
      if (nextTutor) {
        post.currentAssignedTutor = nextTutor.tutorId;
        post.assignedAt = new Date();
        post.responseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await post.save();

        // TODO: Send notification to the next tutor

        // Decrease trust score of tutor who didn't respond
        const tutor = await Tutor.findById(post.currentAssignedTutor);
        if (tutor) {
          tutor.trustScore = Math.max(0, (tutor.trustScore || 0) - 0.2);
          tutor.responseRate = calculateNewResponseRate(
            tutor.responseRate || 0,
            false
          );
          await tutor.save();
        }
      } else {
        // No more eligible tutors
        post.status = "pending";
        await post.save();

        // TODO: Notify student that no tutors are available
      }
    }
  } catch (error) {
    console.error("Error checking expired requests:", error);
  }
};

// Run this check periodically (e.g., set up a cron job)
// For testing: checkExpiredRequests();

// Lấy danh sách bài đăng
const getPosts = async (req, res) => {
  try {
    const role = req.user.role;
    if (role === "tutor") {
      return getPostsForTutor(req, res);
    }
    return getPostsForStudent(req, res);
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách bài đăng: " + error.message,
    });
  }
};

// Lấy danh sách bài đăng cho giảng viên
const getPostsForTutor = async (req, res) => {
  try {
    const userId = req.user._id;
    const tutor = await Tutor.findOne({ userId });

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin giảng viên",
      });
    }

    // Get assigned posts that are waiting for this tutor's confirmation
    const assignedPosts = await Post.find({
      currentAssignedTutor: tutor._id,
      status: "waiting_tutor_confirmation",
    }).populate("studentId", "name email avatar");

    // Get posts that the tutor is eligible for but not yet assigned
    const eligiblePosts = await Post.find({
      "eligibleTutors.tutorId": tutor._id,
      currentAssignedTutor: { $ne: tutor._id },
      status: "waiting_tutor_confirmation",
    }).populate("studentId", "name email avatar");

    // Get posts that the tutor can potentially apply for (matching subject/grade)
    const eligibleSubjects = tutor.subjects.map((s) => s.name);
    const eligibleGrades = tutor.subjects.flatMap((s) => s.grades);

    const availablePosts = await Post.find({
      status: "pending",
      subject: { $in: eligibleSubjects },
      grade: { $in: eligibleGrades },
      "rejectedTutors.tutorId": { $ne: tutor._id }, // Not already rejected by this tutor
    }).populate("studentId", "name email avatar");

    res.json({
      status: "success",
      data: {
        assignedPosts,
        eligiblePosts,
        availablePosts,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách bài đăng: " + error.message,
    });
  }
};

// Lấy danh sách bài đăng cho học viên
const getPostsForStudent = async (req, res) => {
  try {
    const studentId = req.user._id;
    const posts = await Post.find({ studentId })
      .populate({
        path: "classId",
        populate: {
          path: "tutorId",
          populate: { path: "userId", select: "name email avatar" },
        },
      })
      .populate({
        path: "currentAssignedTutor",
        populate: { path: "userId", select: "name email avatar phone" },
      });
    res.json({
      status: "success",
      data: posts,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách bài đăng: " + error.message,
    });
  }
};

// Lấy thông tin chi tiết bài đăng
const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId)
      .populate("studentId", "name email avatar")
      .populate({
        path: "classId",
        populate: {
          path: "tutorId",
          populate: { path: "userId", select: "name email avatar" },
        },
      })
      .populate({
        path: "currentAssignedTutor",
        populate: { path: "userId", select: "name email avatar" },
      });

    if (!post) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin bài đăng",
      });
    }

    res.json({
      status: "success",
      data: post,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thông tin bài đăng: " + error.message,
    });
  }
};

// Chọn thời gian thay thế
const selectAlternativeTime = async (req, res) => {
  try {
    const postId = req.params.id;
    const { alternativeIndex, startDate, endDate } = req.body;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin bài đăng",
      });
    }

    // Kiểm tra quyền truy cập
    if (post.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Kiểm tra index hợp lệ
    if (
      !post.alternativeTimes ||
      alternativeIndex >= post.alternativeTimes.length
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Thời gian thay thế không hợp lệ",
      });
    }

    const selectedAlternative = post.alternativeTimes[alternativeIndex];

    // Cập nhật post với thời gian đã chọn
    post.timeSlot = selectedAlternative.timeSlot;
    post.day = selectedAlternative.day;
    post.status = "matched";
    post.alternativeTimes = [];

    await post.save();

    // Tạo class tương ứng
    const newClass = new Class({
      tutorId: selectedAlternative.tutorId,
      studentId: post.studentId,
      timeSlot: selectedAlternative.timeSlot,
      day: selectedAlternative.day,
      startDate: startDate || post.startDate,
      endDate: endDate || post.endDate,
      subject: post.subject,
      grade: post.grade,
      requirements: post.requirements,
      classPrice: selectedAlternative.classPrice,
      status: "active",
    });

    await newClass.save();

    // Cập nhật post với class ID
    post.classId = newClass._id;
    await post.save();

    res.json({
      status: "success",
      message: "Đã chọn thời gian thay thế thành công",
      data: post,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi chọn thời gian thay thế: " + error.message,
    });
  }
};

// Hủy bài đăng
const cancelPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin bài đăng",
      });
    }

    // Kiểm tra quyền truy cập
    if (
      post.studentId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Cập nhật trạng thái bài đăng
    post.status = "canceled";
    await post.save();

    // Nếu đã có class, hủy class
    if (post.classId) {
      await Class.findByIdAndUpdate(post.classId, {
        status: "canceled",
      });
    }

    res.json({
      status: "success",
      message: "Đã hủy bài đăng thành công",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi hủy bài đăng: " + error.message,
    });
  }
};

// Lấy danh sách bài đăng được gán cho giảng viên
const getAssignedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const tutor = await Tutor.findOne({ userId });

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin giảng viên",
      });
    }

    // Get posts that are currently assigned to this tutor and waiting for confirmation
    const currentAssignedPosts = await Post.find({
      currentAssignedTutor: tutor._id,
      status: "waiting_tutor_confirmation",
    })
      .populate("studentId", "name email avatar")
      .sort({ responseDeadline: 1 }); // Sort by deadline, most urgent first

    // Get posts that this tutor has accepted and are matched (active classes)
    const acceptedPosts = await Post.find({
      status: "matched",
      classId: { $exists: true },
    })
      .populate("studentId", "name email avatar")
      .populate({
        path: "classId",
        match: {
          tutorId: tutor._id,
          status: "active",
        },
      })
      .then((posts) => posts.filter((post) => post.classId !== null)); // Filter only posts where class exists and matches tutor

    // Get posts that this tutor has rejected
    const rejectedPosts = await Post.find({
      "rejectedTutors.tutorId": tutor._id,
    })
      .populate("studentId", "name email avatar")
      .sort({ updatedAt: -1 }) // Most recently rejected first
      .limit(10);

    // Count total assigned posts and get statistics
    const totalAssignedCount = await Post.countDocuments({
      $or: [
        {
          currentAssignedTutor: tutor._id,
          status: "waiting_tutor_confirmation",
        },
        {
          status: "matched",
          "eligibleTutors.tutorId": tutor._id,
        },
      ],
    });

    const acceptedCount = acceptedPosts.length;
    const rejectedCount = await Post.countDocuments({
      "rejectedTutors.tutorId": tutor._id,
    });

    res.json({
      status: "success",
      data: {
        currentAssignedPosts,
        acceptedPosts,
        rejectedPosts,
        stats: {
          totalAssigned: totalAssignedCount,
          accepted: acceptedCount,
          rejected: rejectedCount,
          acceptanceRate:
            totalAssignedCount > 0
              ? Math.round(
                  (acceptedCount / (acceptedCount + rejectedCount)) * 100
                )
              : 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách đơn thuê: " + error.message,
    });
  }
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  selectAlternativeTime,
  cancelPost,
  acceptPost,
  rejectPost,
  checkExpiredRequests,
  getAssignedPosts,
};
