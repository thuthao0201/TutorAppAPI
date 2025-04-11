const Tutor = require("../models/tutor.model");
const User = require("../models/user.model");
const {
  hashPassword
} = require("../utils/auth.util");

const createTutor = async (req, res) => {
  try {
    const {email, password} = req.body;
    const userExists = await User.exists({email});
    if (userExists) {
      return res.status(400).json({
        status: "fail",
        data: {email: "Email already exists"},
      });
    }
    const avatar = req.file.path;
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      ...req.body,
      password: passwordHash,
      role: "tutor",
      avatar,
    });

    const tutor = new Tutor({...req.body, userId: user._id});
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
    const tutors = await Tutor.find({}).populate(
      "userId",
      "name email phone avatar"
    );
    res.json({
      status: "success",
      data: tutors,
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
    const tutor = await Tutor.findById(req.params.id)
      .populate("userId")
      .populate({
        path: "recentReviews",
        populate: {path: "userId", select: "name avatar phone"},
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
      message: "Có lỗi xảy ra khi tìm thông tin gia sư: " + error.message,
    });
  }
};

// Xem lai sau
const getAvailableTutors = async (req, res) => {
  try {
    const {subject, day, time} = req.query; // Lọc theo môn học, ngày, khung giờ
    let tutors = await Tutor.find({subjects: subject}); //Lấy danh sách gia sư có thể dạy môn học này
    //Lọc gia sư chưa có lịch dạy trùng giờ
    tutors = tutors.filter((tutor) => {
      const bookedSlots = tutor.schedule.get(day) || [];
      return !bookedSlots.includes(time);
    });

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

module.exports = {
  createTutor,
  getTutors,
  getTutor,
  updateTutor,
  deleteTutor,
  getAvailableTutors,
};
