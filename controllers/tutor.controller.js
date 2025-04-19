const Tutor = require("../models/tutor.model");
const User = require("../models/user.model");
const Favorite = require("../models/favorite.model");
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

    // Handle case when no file is uploaded
    const avatar = req.file ? req.file.path : null;
    if (!avatar) {
      return res.status(400).json({
        status: "fail",
        message: "Vui lòng tải lên ảnh đại diện",
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      ...req.body,
      password: passwordHash,
      role: "tutor",
      avatar,
    });

    const tutor = new Tutor({ ...req.body, userId: user._id });
    await tutor.save();
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
        query.subjects.$elemMatch = { subject: subject };
      }

      if (grade) {
        if (!query.subjects.$elemMatch) {
          query.subjects.$elemMatch = {};
        }
        query.subjects.$elemMatch.grades = { $in: [grade] };
      }
    }

    // Lọc theo gia sư nổi bật - dựa vào số session đã dạy qua
    if (isFeatured === "true") {
      // Lấy gia sư có số buổi dạy từ một ngưỡng nhất định trở lên (ví dụ: 10 buổi)
      query.completedSessions = { $gte: 10 };
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
        { "subjects.subject": { $regex: search, $options: "i" } },
      ];
    }

    // Lấy danh sách tutor và populate thông tin user
    let tutorsQuery = Tutor.find(query)
      .populate("userId", "name email phone avatar")
      .limit(parseInt(limit))
      .skip(skip);

    // Lọc theo gia sư được theo dõi (yêu thích) bởi người dùng hiện tại
    let tutors = await tutorsQuery;

    // Lấy danh sách các tutorId mà user đã follow (nếu user đã đăng nhập)
    let followedTutorIds = [];
    if (req.user) {
      const favorites = await Favorite.find({ studentId: req.user._id });
      followedTutorIds = favorites.map((fav) => fav.tutorId.toString());
    }

    if (followed === "true" && req.user) {
      // Lấy danh sách gia sư mà người dùng đã yêu thích
      tutors = tutors.filter((tutor) =>
        followedTutorIds.includes(tutor._id.toString())
      );
    }

    // Thêm thông tin follow status vào mỗi tutor
    const tutorsWithFollowStatus = tutors.map((tutor) => {
      const tutorObject = tutor.toObject();
      tutorObject.isFollowed = followedTutorIds.includes(tutor._id.toString());
      return tutorObject;
    });

    // Sắp xếp theo các tiêu chí
    if (sort === "rating") {
      tutorsWithFollowStatus.sort((a, b) => b.avgRating - a.avgRating);
    } else if (sort === "price") {
      tutorsWithFollowStatus.sort((a, b) => a.sessionPrice - b.sessionPrice);
    } else if (sort === "newest") {
      tutorsWithFollowStatus.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else if (sort === "sessions") {
      tutorsWithFollowStatus.sort(
        (a, b) => b.completedSessions - a.completedSessions
      );
    } else {
      // Mặc định: sắp xếp theo điểm uy tín và đánh giá (kết hợp)
      tutorsWithFollowStatus.sort((a, b) => {
        // Tính điểm tổng hợp từ trustScore và avgRating
        const scoreA = a.trustScore * 0.6 + a.avgRating * 8; // Trọng số: 60% trustScore, 40% avgRating
        const scoreB = b.trustScore * 0.6 + b.avgRating * 8;
        return scoreB - scoreA; // Sắp xếp giảm dần
      });
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
    if (req.user) {
      const followed = await Favorite.exists({
        studentId: req.user._id,
        tutorId: tutor._id,
      });
      console.log(followed);

      isFollowed = !!followed;
    }

    // Create a response object with tutor data and follow status
    const tutorResponse = {
      ...tutor.toObject(),
      isFollowed,
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
  try {
    const tutor = await Tutor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy thông tin gia sư",
      });
    }
    res.json({
      status: "success",
      data: tutor,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật thông tin gia sư: " + error.message,
    });
  }
};

const deleteTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findByIdAndDelete(req.params.id);
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

module.exports = {
  createTutor,
  getTutors,
  getTutor,
  updateTutor,
  deleteTutor,
  getAvailableTutors,
  getTutorFavoriteCount,
};
