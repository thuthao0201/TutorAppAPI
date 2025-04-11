const express = require("express");
const router = express.Router();

const {
  reviewTutor,
  getReviews,
  getReview,
  getReviewsByTutor,
  updateReview,
  deleteReview,
} = require("../controllers/review.controller");

router.get("/:id", getReview);
router.patch("/:id", updateReview);
router.delete("/:id", deleteReview);

module.exports = router;
