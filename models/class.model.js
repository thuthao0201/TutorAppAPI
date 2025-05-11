const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },
    grade: {
      //
      type: String,
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    time: {
      type: String,
      required: true,
      enum: ["7:00-9:00", "9:30-11:30", "13:00-15:00", "15:30-17:30", "19:00-21:00"]
    },
    day: [{
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    }],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    expectedPrice: {
      type: Number,
      default: 0, // Giá 0 có nghĩa là không giới hạn giá
    },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "matched", "canceled"],
    },
    sessionId: {
      
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    requirements: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Class", classSchema);