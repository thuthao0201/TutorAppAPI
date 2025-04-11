const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      name: {
        type: String,
        required: true,
      },
      grades: {
        type: String,
        required: true,
      },
    },
    time: {
      type: String,
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    weekly: {
      type: Boolean,
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
    duration: {
      type: Number,
      default: 120,
    },
    requirements: {
      type: String,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    status: {
      type: String,
      default: "open",
      enum: ["open", "matched", "closed"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Class", classSchema);
