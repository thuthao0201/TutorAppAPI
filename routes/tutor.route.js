const express = require("express");
const router = express.Router();

const {
  createTutor,
  getTutors,
  getTutor,
  updateTutor,
  deleteTutor,
  getOwnTutorProfile,
  getTutorStats,
} = require("../controllers/tutor.controller");

const {
  isAdmin,
  isAdminOrTutor,
  isOwnerOrAdmin,
} = require("../middlewares/role.middleware");

const {
  reviewTutor,
  getReviewsByTutor,
} = require("../controllers/review.controller");

const {
  addFavorite,
  removeFavorite,
} = require("../controllers/favorite.controller");

const { createBooking } = require("../controllers/booking.controller");
const upload = require("../configs/multer");

router.post("/:tutorId/reviews", reviewTutor);
router.post("/:tutorId/bookings", createBooking);
router.post("/:tutorId/favorite", addFavorite);
router.post("/", isAdmin, upload.single("avatar"), createTutor);
router.get("/me", isAdminOrTutor, getOwnTutorProfile);
router.get("/stats", getTutorStats);
router.get("/:tutorId", getTutor);
router.get("/:tutorId/reviews", getReviewsByTutor);
router.get("/", getTutors);
router.patch("/:tutorId", isOwnerOrAdmin, updateTutor);
router.delete("/:tutorId/favorite", removeFavorite);
router.delete("/:tutorId", isAdmin, deleteTutor);

module.exports = router;
