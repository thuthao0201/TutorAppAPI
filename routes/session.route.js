const express = require("express");
const router = express.Router();

const {
    createSession,
    getSessions,
    getSession,
    updateSession,
    completeSession,
    cancelSession,
    rescheduleSession,
    getSessionHistory
} = require("../controllers/session.controller");

const {isAdmin, isOwnerOrAdmin, isAdminOrTutor} = require("../middlewares/role.middleware");

// Tạo phiên học mới
router.post("/", createSession);

// Lấy danh sách phiên học
router.get("/", getSessions);

// Lấy lịch sử phiên học của một lớp/booking
router.get("/history", getSessionHistory);

// Lấy chi tiết phiên học
router.get("/:id", getSession);

// Cập nhật thông tin phiên học
router.patch("/:id", isOwnerOrAdmin, updateSession);

// Đánh dấu phiên học đã hoàn thành
router.patch("/:id/complete", isAdminOrTutor, completeSession);

// Lên lịch lại phiên học
router.patch("/:id/reschedule", isOwnerOrAdmin, rescheduleSession);

// Hủy phiên học
router.patch("/:id/cancel", isOwnerOrAdmin, cancelSession);

module.exports = router;
