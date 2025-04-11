const express = require("express");
const router = express.Router();

const {
  createTutor,
  getTutors,
  getTutor,
  updateTutor,
  deleteTutor,
} = require("../controllers/tutor.controller");

const {isAdmin, isAdminOrTutor, isOwnerOrAdmin} = require("../middlewares/role.middleware");

const {
  reviewTutor,
  getReviewsByTutor,
} = require("../controllers/review.controller");

const {createBooking} = require("../controllers/booking.controller");
const upload = require("../configs/multer");

router.post("/:id/reviews", reviewTutor);
router.post("/:id/bookings", createBooking);
router.post("/", isAdmin, upload.single("avatar"), createTutor);
router.get("/:id", getTutor);
router.get("/:tutorId/reviews", getReviewsByTutor);
router.get("/", getTutors);
router.patch("/:id", isOwnerOrAdmin, updateTutor);
router.delete("/:id", isAdmin, deleteTutor);

module.exports = router;
