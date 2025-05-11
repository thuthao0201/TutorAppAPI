const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
      enum: ["7:00-9:00", "9:30-11:30", "13:00-15:00", "15:30-17:30", "19:00-21:00"]
    },
    day: {
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
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
      enum: ["pending", "matched", "canceled", "waiting_tutor_confirmation"],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },
    requirements: {
      type: String,
    },
    // Add fields for eligible and rejected tutors
    eligibleTutors: [{
      tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tutor",
      },
      score: {
        type: Number,
        default: 0,
      }
    }],
    rejectedTutors: [{
      tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tutor",
      },
      reason: {
        type: String,
      },
      rejectedAt: {
        type: Date,
        default: Date.now,
      }
    }],
    currentAssignedTutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
    },
    assignedAt: {
      type: Date,
    },
    responseDeadline: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);