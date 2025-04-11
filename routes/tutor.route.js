const express = require("express");
const router = express.Router();

const {
  createTutor,
  getTutors,
  getTutor,
  updateTutor,
  deleteTutor,
} = require("../controllers/tutor.controller");

const {
  reviewTutor,
  getReviewsByTutor,
} = require("../controllers/review.controller");

const { createBooking } = require("../controllers/booking.controller");

router.post("/:id/reviews", reviewTutor);
router.post("/:id/bookings", createBooking);
router.post("/", createTutor);
router.get("/:id", getTutor);
router.get("/:tutorId/reviews", getReviewsByTutor);
router.get("/", getTutors);
router.patch("/:id", updateTutor);
router.delete("/:id", deleteTutor);

module.exports = router;
