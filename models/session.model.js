const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      // required: true,
    },
    duration: {
      type: Number,
      default: 120,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    time: {
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
    day: [
      {
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
    ],
    subject: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      required: true,
    },
    requirements: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Session", sessionSchema);
