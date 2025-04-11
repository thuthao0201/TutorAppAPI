const express = require("express");
const router = express.Router();

const {
  getBookings,
  getBooking,
  updateBooking,
  cancelBooking,
} = require("../controllers/booking.controller");

const {isOwnerOrAdmin} = require("../middlewares/role.middleware");

router.get("/:id", isOwnerOrAdmin, getBooking);
router.get("/", getBookings);
router.patch("/:id", isOwnerOrAdmin, updateBooking);
router.delete("/:id", isOwnerOrAdmin, cancelBooking);

module.exports = router;
