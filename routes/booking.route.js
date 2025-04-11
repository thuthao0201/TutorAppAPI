const express = require("express");
const router = express.Router();

const {
  getBookings,
  getBooking,
  updateBooking,
  cancelBooking,
} = require("../controllers/booking.controller");

router.get("/:id", getBooking);
router.get("/", getBookings);
router.patch("/:id", updateBooking);
router.delete("/:id", cancelBooking);

module.exports = router;
