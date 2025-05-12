const express = require("express");
const router = express.Router();

const {
  createClass,
  getClasses,
  getClass,
  updateClass,
  completeClass,
  cancelClass,
  rescheduleClass,
  getClassHistory,
} = require("../controllers/class.controller");

const {
  isAdmin,
  isOwnerOrAdmin,
  isAdminOrTutor,
} = require("../middlewares/role.middleware");

// Tạo lớp học mới
router.post("/", createClass);

// Lấy danh sách lớp học
router.get("/", getClasses);

// Lấy lịch sử lớp học của một lớp/booking
router.get("/history", getClassHistory);

// Lấy chi tiết lớp học
router.get("/:id", getClass);

// Cập nhật thông tin lớp học
router.patch("/:id", isOwnerOrAdmin, updateClass);

// Đánh dấu lớp học đã hoàn thành
router.patch("/:id/complete", isAdminOrTutor, completeClass);

// Lên lịch lại lớp học
router.patch("/:id/reschedule", isOwnerOrAdmin, rescheduleClass);

// Hủy lớp học
router.patch("/:id/cancel", isOwnerOrAdmin, cancelClass);

module.exports = router;
