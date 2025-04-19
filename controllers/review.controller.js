const Review = require("../models/review.model");
const Tutor = require("../models/tutor.model");

const reviewTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.tutorId);

    if (!tutor) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy gia sư",
      });
    }

    const review = await Review.create({
      ...req.body,
      tutorId: req.params.tutorId,
      userId: req.user._id,
    });
    if (!review) {
      return res.status(400).json({
        status: "fail",
        message: "Không thể tạo đánh giá",
      });
    }
    tutor.recentReviews.push(review._id);
    if (tutor.recentReviews.length > 5) {
      tutor.recentReviews.shift();
    }
    tutor.totalReviews += 1;
    tutor.totalStar += review.rating;
    tutor.avgRating = tutor.totalStar / tutor.totalReviews;
    await tutor.save();
    res.status(201).json({
      status: "success",
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo đánh giá: " + error.message,
    });
  }
};

const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({});
    res.json({
      status: "success",
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách đánh giá: " + error.message,
    });
  }
};

const getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy đánh giá",
      });
    }
    res.json({
      status: "success",
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tìm đánh giá: " + error.message,
    });
  }
};

const getReviewsByTutor = async (req, res) => {
  try {
    const reviews = await Review.find({tutorId: req.params.tutorId});
    res.json({
      status: "success",
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách đánh giá: " + error.message,
    });
  }
};

const updateReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!review) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy đánh giá",
      });
    }

    res.json({
      status: "success",
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật đánh giá: " + error.message,
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy đánh giá",
      });
    }
    res.json({
      status: "success",
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi xóa đánh giá: " + error.message,
    });
  }
};

module.exports = {
  reviewTutor,
  getReviews,
  getReview,
  getReviewsByTutor,
  updateReview,
  deleteReview,
};
