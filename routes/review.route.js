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

const { isAdmin, isOwnerOrAdmin } = require("../middlewares/role.middleware");

router.get("/", isAdmin, getReviews);
router.get("/:id", getReview);
router.patch("/:id", isOwnerOrAdmin, updateReview);
router.delete("/:id", isOwnerOrAdmin, deleteReview);

module.exports = router;
