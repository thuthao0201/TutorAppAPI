const express = require("express");
const router = express.Router();
const userRoute = require("../routes/user.route");
const tutorRoute = require("../routes/tutor.route");
const bookingRoute = require("../routes/booking.route");
const reviewRoute = require("../routes/review.route");
const classRoute = require("../routes/class.route");

router.use("/users", userRoute);
router.use("/tutors", tutorRoute);
router.use("/bookings", bookingRoute);
router.use("/reviews", reviewRoute);
router.use("/classes", classRoute);

module.exports = router;
