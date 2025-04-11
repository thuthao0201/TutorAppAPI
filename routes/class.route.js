const express = require("express");
const router = express.Router();

const {
  createClass,
  getClasses,
  getClass,
  selectAlternativeTime,
  cancelClass
} = require("../controllers/class.controller");

const { isOwnerOrAdmin } = require("../middlewares/role.middleware");

// Tạo lớp mới
router.post("/", createClass);

// Lấy danh sách lớp học
router.get("/", getClasses);

// Lấy thông tin chi tiết lớp học
router.get("/:id", isOwnerOrAdmin, getClass);

// Chọn thời gian thay thế
router.patch("/:id/select-time", isOwnerOrAdmin, selectAlternativeTime);

// Hủy lớp học
router.delete("/:id", isOwnerOrAdmin, cancelClass);

module.exports = router;