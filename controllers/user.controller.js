const User = require("../models/user.model");
const { hashPassword, comparePassword } = require("../utils/auth.util");

const createUser = async (req, res) => {
  try {
    const password = await hashPassword(req.body.password);
    const user = new User({ ...req.body, password });
    await user.save();
    res.status(201).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo người dùng: " + error.message,
    });
  }
};

// Them pagination va filter cho getUsers
const getUsers = async (req, res) => {
  try {
    const { role, search, sort, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Build query object
    let query = {};

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Query users
    let usersQuery = User.find(query).limit(parseInt(limit)).skip(skip);

    // Sort users
    if (sort) {
      const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith("-") ? -1 : 1;
      usersQuery = usersQuery.sort({ [sortField]: sortOrder });
    }

    const users = await usersQuery;

    // Count total users matching the query
    const total = await User.countDocuments(query);

    res.json({
      status: "success",
      data: users,
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
      message: "Có lỗi xảy ra khi lấy danh sách người dùng: " + error.message,
    });
  }
};

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }
    res.json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tìm người dùng: " + error.message,
    });
  }
};

// Admin moi co quyen update nay
const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }
    res.json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật người dùng: " + error.message,
    });
  }
};

// Admin moi co quyen
// Xoa ca cac booking, class, review, session va tutor co lien quan
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }
    res.json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi xóa người dùng: " + error.message,
    });
  }
};

const getInformation = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -__v -createdAt -updatedAt"
    );
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }
    res.json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thông tin người dùng: " + error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }

    const isMatch = await comparePassword(req.body.oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: "fail",
        message: "Mật khẩu cũ không đúng",
      });
    }

    user.password = await hashPassword(req.body.newPassword);
    await user.save();

    res.json({
      status: "success",
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi đổi mật khẩu: " + error.message,
    });
  }
};

const changeInformation = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }
    res.json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message:
        "Có lỗi xảy ra khi cập nhật thông tin người dùng: " + error.message,
    });
  }
};

const changeAvatar = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.path },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy người dùng",
      });
    }
    res.json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message:
        "Có lỗi xảy ra khi cập nhật thông tin người dùng: " + error.message,
    });
  }
};

const getStudentStats = async (req, res) => {
  console.log("getStudentStats");
  try {
    const total = await User.countDocuments({ role: "student" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newThisMonth = await User.countDocuments({
      role: "student",
      createdAt: { $gte: thirtyDaysAgo },
    });

    const stats = {
      total: total,
      newThisMonth: newThisMonth,
    };

    res.json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy thống kê học sinh: " + error.message,
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getInformation,
  changePassword,
  changeInformation,
  changeAvatar,
  getStudentStats,
};
