const Tutor = require("../models/tutor.model");
const User = require("../models/user.model");
const Review = require("../models/review.model");
const Favorite = require("../models/favorite.model");
const Class = require("../models/class.model"); // Add Class model import
const { hashPassword } = require("../utils/auth.util");

const createTutor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userExists = await User.exists({ email });
    if (userExists) {
      return res.status(400).json({
        status: "fail",
        data: { email: "Email already exists" },
      });
    }

    const avatar = req.file ? req.file.path : "/uploads/default-avatar.png";
    // if (!avatar) {
    //   return res.status(400).json({
    //     status: "fail",
    //     message: "Vui lòng tải lên ảnh đại diện"
    //   });
    // }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      ...req.body,
      password: passwordHash,
      role: "tutor",
      avatar,
    });

    const tutor = new Tutor({ ...req.body, userId: user._id });
    await tutor.save();
    // Populate the userId field in the tutor document
    await tutor.populate("userId");
    res.status(201).json({
      status: "success",
      data: tutor,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo thông tin gia sư: " + error.message,
    });
  }
};

// Thêm pagination và filter cho getTutors
const getTutors = async (req, res) => {
  try {
    const {
      sort,
      limit = 20,
      page = 1,
      subject,
      grade,
      isFeatured,
      isNew,
      followed,
      search,
    } = req.query;
    const skip = (page - 1) * limit;

    // Xây dựng query để lọc tutors
    let query = {};

    // Lọc theo môn học và khối lớp nếu có
    if (subject || grade) {
      query.subjects = {};

      if (subject) {
        query.subjects.$elemMatch = { name: subject };
      }

      if (grade) {
        if (!query.subjects.$elemMatch) {
          query.subjects.$elemMatch = {};
        }
        query.subjects.$elemMatch.grades = { $in: [grade] };
      }
    }

    // Lọc theo gia sư mới (đăng ký trong 30 ngày gần đây)
    if (isNew === "true") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.createdAt = { $gte: thirtyDaysAgo };
    }

    // Tìm kiếm theo tên gia sư hoặc môn học
    if (search) {
      // Sử dụng aggregation để tìm kiếm
      const userIds = await User.find(
        { name: { $regex: search, $options: "i" }, role: "tutor" },
        { _id: 1 }
      );

      // Tìm theo tên hoặc môn học
      query.$or = [
        { userId: { $in: userIds.map((user) => user._id) } },
        { "subjects.name": { $regex: search, $options: "i" } },
      ];
    }

    // Lấy danh sách tutor và populate thông tin user
    let tutorsQuery = Tutor.find(query)
      .populate("userId", "name email phone avatar")
      .limit(parseInt(limit))
      .skip(skip);

    // Lấy danh sách các tutorId mà user đã follow (nếu user đã đăng nhập)
    let followedTutorIds = [];
    if (req.user) {
      const favorites = await Favorite.find({ studentId: req.user._id });
      followedTutorIds = favorites.map((fav) => fav.tutorId.toString());
    }

    let tutors = await tutorsQuery;

    // Lọc theo gia sư được theo dõi (yêu thích) bởi người dùng hiện tại
    if (followed === "true" && req.user) {
      // Lấy danh sách gia sư mà người dùng đã yêu thích
      tutors = tutors.filter((tutor) =>
        followedTutorIds.includes(tutor._id.toString())
      );
    }

    // Thêm thông tin follow status vào mỗi tutor
    let tutorsWithFollowStatus = tutors.map((tutor) => {
      const tutorObject = tutor.toObject();
      tutorObject.isFollowed = followedTutorIds.includes(tutor._id.toString());
      return tutorObject;
    });

    // Phân tích chuỗi sort để xác định trường và hướng sắp xếp
    let sortField = "default";
    let sortOrder = 1; // 1 cho tăng dần, -1 cho giảm dần

    if (sort) {
      if (sort.startsWith("-")) {
        sortField = sort.substring(1);
        sortOrder = -1; // Giảm dần
      } else {
        sortField = sort;
        sortOrder = 1; // Tăng dần
      }
    }

    // Sắp xếp theo các tiêu chí
    switch (sortField) {
      case "rating":
        tutorsWithFollowStatus.sort(
          (a, b) => (a.avgRating - b.avgRating) * sortOrder
        );
        break;
      case "price":
        tutorsWithFollowStatus.sort(
          (a, b) => (a.sessionPrice - b.sessionPrice) * sortOrder
        );
        break;
      case "newest":
        tutorsWithFollowStatus.sort(
          (a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) * sortOrder
        );
        break;
      case "sessions":
      case "completedClasses":
        tutorsWithFollowStatus.sort(
          (a, b) => (a.completedClasses - b.completedClasses) * sortOrder
        );
        break;
      case "consecutive":
      case "consecutiveCompletedClasses":
        tutorsWithFollowStatus.sort(
          (a, b) =>
            (a.consecutiveCompletedClasses - b.consecutiveCompletedClasses) *
            sortOrder
        );
        break;
      default:
        // Mặc định: sắp xếp theo điểm uy tín và đánh giá (kết hợp)
        tutorsWithFollowStatus.sort((a, b) => {
          // Tính điểm tổng hợp từ trustScore và avgRating
          const scoreA = a.trustScore * 0.6 + a.avgRating * 8; // Trọng số: 60% trustScore, 40% avgRating
          const scoreB = b.trustScore * 0.6 + b.avgRating * 8;
          return (scoreA - scoreB) * sortOrder; // Sắp xếp theo sortOrder
        });
    }

    // Lọc theo gia sư nổi bật - dựa vào completedClasses và consecutiveCompletedClasses
    if (isFeatured === "true") {
      // Sắp xếp theo completedClasses và consecutiveCompletedClasses
      const featuredTutors = [...tutorsWithFollowStatus]; // Tạo một bản sao để sắp xếp

      // Sắp xếp ưu tiên theo completedClasses, sau đó là consecutiveCompletedClasses
      featuredTutors.sort((a, b) => {
        if (b.completedClasses !== a.completedClasses) {
          return b.completedClasses - a.completedClasses;
        }
        return b.consecutiveCompletedClasses - a.consecutiveCompletedClasses;
      });

      // Chỉ lấy top 30% và có ít nhất có 5 buổi đã hoàn thành
      const featuredCount = Math.max(Math.ceil(featuredTutors.length * 0.3), 1);
      const minCompletedClasses = 5;

      tutorsWithFollowStatus = featuredTutors.filter(
        (tutor, index) =>
          index < featuredCount && tutor.completedClasses >= minCompletedClasses
      );
    }

    // Đếm tổng số tutors thỏa mãn điều kiện
    const total =
      followed === "true" && req.user
        ? tutorsWithFollowStatus.length
        : await Tutor.countDocuments(query);

    res.json({
      status: "success",
      data: tutorsWithFollowStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message:
        "Có lỗi xảy ra khi lấy danh sách thông tin gia sư: " + error.message,
    });
  }
};

const getTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.tutorId)
      .populate("userId")
      .populate({
        path: "recentReviews",
        populate: { path: "userId", select: "name avatar phone" },
      });
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin gia sư",
      });
    }

    // Check if the tutor is followed by the current user
    let isFollowed = false;
    // Initialize review ability variables
    let canReview = false;
    let hasReviewed = false;

    if (req.user) {
      const followed = await Favorite.exists({
        studentId: req.user._id,
        tutorId: tutor._id,
      });

      isFollowed = !!followed;

      // Check if the user can review this tutor
      if (req.user.role === "student") {
        // Find completed or canceled classes with at least one session
        const eligibleClasses = await Class.exists({
          tutorId: tutor._id,
          studentId: req.user._id,
          $or: [
            { status: "completed" },
            { status: "canceled", completedSessions: { $gte: 1 } }, // Assuming there's a completedSessions field
          ],
        });

        // Check if the user already reviewed this tutor
        const existingReview = await Review.exists({
          tutorId: tutor._id,
          userId: req.user._id,
        });

        canReview = !!eligibleClasses;
        hasReviewed = !!existingReview;
      }
    }

    // Get current date and time
    const now = new Date();

    // Calculate minimum time for classes (current time + 2 hours)
    const minStartTime = new Date(now);
    minStartTime.setHours(now.getHours() + 2);

    // Query to get upcoming classes
    const classesQuery = {
      tutorId: tutor._id,
      status: "active",
      startDate: { $gte: minStartTime }, // Classes starting at least 2 hours from now
    };

    // Get upcoming classes and sort by start date
    const upcomingClasses = await Class.find(classesQuery)
      .sort({ startDate: 1 })
      .populate("studentId", "name avatar phone");

    // Create a response object with tutor data, follow status, and upcoming classes
    const tutorResponse = {
      ...tutor.toObject(),
      isFollowed,
      canReview,
      hasReviewed,
      upcomingClasses,
    };

    res.json({
      status: "success",
      data: tutorResponse,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tìm thông tin gia sư: " + error.message,
    });
  }
};

// Xem lai sau
const getAvailableTutors = async (req, res) => {
  try {
    const { subject, grade, day, time, sort } = req.query; // Lọc theo môn học, lớp, ngày, khung giờ

    // Xây dựng query
    let query = {};

    // Lọc theo môn học và lớp nếu có
    if (subject || grade) {
      query.subjects = {};

      if (subject) {
        query.subjects.$elemMatch = { subject: subject };
      }

      if (grade) {
        if (!query.subjects.$elemMatch) {
          query.subjects.$elemMatch = {};
        }
        query.subjects.$elemMatch.grades = { $in: [grade] };
      }
    }

    // Lấy danh sách gia sư có thể dạy môn học và lớp này
    let tutors = await Tutor.find(query).populate(
      "userId",
      "name email phone avatar"
    );

    // Lọc gia sư theo lịch trống
    if (day && time) {
      tutors = tutors.filter((tutor) => {
        // Kiểm tra xem tutor có ca học này vào ngày này không
        const availableDay = tutor.availableSchedule.find(
          (schedule) => schedule.day === day
        );
        if (!availableDay) return false;

        return availableDay.timeSlots.includes(time);
      });
    }

    // Sắp xếp theo các tiêu chí
    if (sort === "rating") {
      tutors.sort((a, b) => b.avgRating - a.avgRating);
    } else if (sort === "price") {
      tutors.sort((a, b) => a.sessionPrice - b.sessionPrice);
    } else {
      // Mặc định: sắp xếp theo điểm uy tín và đánh giá (kết hợp)
      tutors.sort((a, b) => {
        // Tính điểm tổng hợp từ trustScore và avgRating
        const scoreA = a.trustScore * 0.6 + a.avgRating * 8;
        const scoreB = b.trustScore * 0.6 + b.avgRating * 8;
        return scoreB - scoreA; // Sắp xếp giảm dần
      });
    }

    res.json({
      status: "success",
      data: tutors,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tìm gia sư: " + error.message,
    });
  }
};

const updateTutor = async (req, res) => {
  console.log(req.body);

  try {
    const tutor = await Tutor.findById(req.params.tutorId);

    const user = await User.findById(tutor.userId);

    const { name, phone } = req.body;

    user.name = name || user.name;
    user.phone = phone || user.phone;

    await user.save();

    tutor.subjects = req.body.subjects || tutor.subjects;
    tutor.classPrice = req.body.classPrice || tutor.classPrice;
    tutor.specialized = req.body.specialized || tutor.specialized;
    tutor.degree = req.body.degree || tutor.degree;
    tutor.hasCertificate = req.body.hasCertificate || tutor.hasCertificate;
    tutor.availableSchedule =
      req.body.availableSchedule || tutor.availableSchedule;
    tutor.introduce = req.body.introduce || tutor.introduce;
    await tutor.save();

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin gia sư",
      });
    }
    res.json({
      status: "success",
      data: {
        ...tutor.toObject(),
        userId: {
          ...user.toObject(),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật thông tin gia sư: " + error.message,
    });
  }
};

const getOwnTutorProfile = async (req, res) => {
  try {
    // Kiểm tra xem người dùng đã đăng nhập chưa và có phải là tutor không
    if (!req.user || req.user.role !== "tutor") {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền truy cập thông tin này",
      });
    }

    // Tìm thông tin tutor dựa trên userId
    const tutor = await Tutor.findOne({ userId: req.user._id })
      .populate("userId", "name email phone avatar")
      .populate({
        path: "recentReviews",
        populate: { path: "userId", select: "name avatar phone" },
      });

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin gia sư của bạn",
      });
    }

    const now = new Date();

    // Lấy các lớp học sắp tới của tutor
    const upcomingClasses = await Class.find({
      tutorId: tutor._id,
      status: "active",
      startDate: { $gte: now },
    })
      .sort({ startDate: 1 })
      .populate("studentId", "name avatar phone");

    // Đếm số lượng học sinh đã follow tutor
    const favoriteCount = await Favorite.countDocuments({ tutorId: tutor._id });

    // Tạo đối tượng phản hồi đầy đủ thông tin
    const tutorResponse = {
      ...tutor.toObject(),
      upcomingClasses,
      favoriteCount,
    };

    res.json({
      status: "success",
      data: tutorResponse,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thông tin gia sư: " + error.message,
    });
  }
};

const deleteTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findByIdAndDelete(req.params.tutorId);
    const user = await User.findByIdAndDelete(tutor.userId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin người dùng",
      });
    }
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin gia sư",
      });
    }
    res.json({
      status: "success",
      message: "Xóa thông tin gia sư thành công",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi xóa thông tin gia sư: " + error.message,
    });
  }
};

// Add method to get tutor's favorite count
const getTutorFavoriteCount = async (req, res) => {
  try {
    const tutorId = req.params.tutorId;

    // Check if tutor exists
    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin gia sư",
      });
    }

    // Count favorites for this tutor
    const count = await Favorite.countDocuments({ tutorId });

    res.json({
      status: "success",
      data: { count },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy số lượt yêu thích: " + error.message,
    });
  }
};

// Thêm hàm mới để lấy thống kê về gia sư
const getTutorStats = async (req, res) => {
  console.log("Fetching tutor stats...");
  try {
    const total = await Tutor.countDocuments();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newThisMonth = await Tutor.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      status: "success",
      data: {
        total: total,
        newThisMonth: newThisMonth,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thống kê gia sư: " + error.message,
    });
  }
};

module.exports = {
  createTutor,
  getTutors,
  getTutor,
  updateTutor,
  deleteTutor,
  getAvailableTutors,
  getTutorFavoriteCount,
  getOwnTutorProfile,
  getTutorStats,
};
