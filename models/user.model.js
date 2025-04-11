const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: "/upload/default-avatar.png",
  },
  refreshToken: {
    type: String,
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  role: {
    type: String,
    default: "student",
    enum: ["student", "tutor", "admin"],
  },
  balance: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("User", userSchema);
