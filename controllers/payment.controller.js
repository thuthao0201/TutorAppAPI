const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { compare } = require("bcrypt");
const Payment = require("../models/payment.model");

createPaymentIntent = async (req, res) => {
  const { amount } = req.body;
  const userId = req.user._id; // Assuming you have user ID from the request context

  if (!amount || !userId) {
    return res.status(400).json({ message: "Amount and userId are required." });
  }

  try {
    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in smallest currency unit (e.g., cents for USD, vnd for VND)
      currency: "vnd",
      metadata: { userId },
    });

    // Save the payment record in the database
    const payment = new Payment({
      userId,
      type: "deposit",
      amount,
      status: "pending",
      paymentIntentId: paymentIntent.id,
    });
    await payment.save();

    // Send the client secret to the client
    res.status(200).json({
      status: "success",
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment._id, // Send the payment ID to the client for reference
      },
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ message: "Failed to create payment intent." });
  }
};

const confirmPayment = async (req, res) => {
  const { paymentId } = req.body; // Get paymentId from request body
  const userId = req.user._id; // Assuming you have user ID from the request context

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({ message: "Payment not found." });
  }

  if (payment.status !== "pending") {
    return res.status(400).json({ message: "Payment already confirmed." });
  }

  try {
    payment.status = "completed"; // Update payment status to completed
    await payment.save();

    res
      .status(200)
      .json({ status: "Success", message: "Payment confirmed successfully." });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({ message: "Failed to confirm payment." });
  }
};

const getPaymentHistory = async (req, res) => {
  const userId = req.user._id; // Assuming you have user ID from the request context

  try {
    const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ status: "success", data: payments });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Failed to fetch payment history." });
  }
};

module.exports = { createPaymentIntent, confirmPayment, getPaymentHistory };
