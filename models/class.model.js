const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    roomId: {
      type: String,
    },
    joinUrl: {
      type: String,
    },
    duration: {
      type: Number,
      default: 120,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
      enum: [
        "7:00-9:00",
        "9:30-11:30",
        "13:00-15:00",
        "15:30-17:30",
        "19:00-21:00",
      ],
    },
    day: {
      type: String,
      required: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    },
    subject: {
      type: String,
    },
    grade: {
      type: String,
    },
    requirements: {
      type: String,
    },
    classPrice: {
      type: Number,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "completed", "canceled"],
    },
    canceledBy: {
      type: String,
      enum: ["tutor", "student", "admin", null],
      default: null,
    },
    cancelReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Class", classSchema);
