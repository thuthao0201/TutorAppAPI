const express = require("express");
const router = express.Router();

const {
  createPost,
  getPosts,
  getPost,
  selectAlternativeTime,
  cancelPost,
  getAssignedPosts,
  acceptPost,
  rejectPost,
} = require("../controllers/post.controller");

const { isOwnerOrAdmin } = require("../middlewares/role.middleware");

// Tạo bài đăng mới
router.post("/", createPost);

router.get("/assigned", getAssignedPosts);

// Lấy danh sách bài đăng
router.get("/", getPosts);

// Lấy thông tin chi tiết bài đăng
router.get("/:id", isOwnerOrAdmin, getPost);

// Chọn thời gian thay thế
router.patch("/:id/select-time", isOwnerOrAdmin, selectAlternativeTime);

// Chấp nhận bài đăng
router.patch("/:id/accept", acceptPost);

// Từ chối bài đăng
router.patch("/:id/reject", rejectPost);

// Hủy bài đăng
router.delete("/:id", isOwnerOrAdmin, cancelPost);

module.exports = router;
