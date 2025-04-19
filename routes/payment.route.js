const express = require("express");
const router = express.Router();
const {
  createPaymentIntent,
  confirmPayment,
  getPaymentHistory,
} = require("../controllers/payment.controller");

// Route for creating a payment intent
router.post("/deposit", createPaymentIntent);
router.post("/confirm", confirmPayment);
router.get("/history", getPaymentHistory); // Route for getting payment history

module.exports = router;
