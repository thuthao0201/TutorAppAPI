const express = require("express");
const router = express.Router();
const userRoute = require("../routes/user.route");
const tutorRoute = require("../routes/tutor.route");
const bookingRoute = require("../routes/booking.route");
const reviewRoute = require("../routes/review.route");
const postRoute = require("../routes/post.route");
const classRoute = require("../routes/class.route");
const paymentRoute = require("../routes/payment.route");

router.use("/users", userRoute);
router.use("/tutors", tutorRoute);
router.use("/bookings", bookingRoute);
router.use("/reviews", reviewRoute);
router.use("/posts", postRoute);
router.use("/classes", classRoute);
router.use("/payments", paymentRoute);

module.exports = router;
