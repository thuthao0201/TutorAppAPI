const mongoose = require("mongoose");

const tutorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    introduce: {
      //Gioi thieu
      type: String,
    },
    specialized: {
      //Chuyen nganh: vidu: nganh giao duc, nganh y
      type: String,
    },
    degree: {
      //Hoc vi: vidu: thac si, cu nhan
      type: String,
    },
    field: {
      //Khu vuc: vidu: TP.HCM, Ha Noi
      type: String,
    },
    hasCertificate: {
      //Da cung cap chung chi cho trung tam chua
      type: Boolean,
      default: false,
    },
    subjects: [
      {
        subject: {
          type: String,
        },
        grades: {
          type: [String],
          enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
        },
      },
    ],
    availableSchedule: [
      {
        day: {
          type: String,
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
        timeSlots: {
          type: [String],
          enum: [
            "7:00-9:00",
            "9:30-11:30",
            "13:00-15:00",
            "15:30-17:30",
            "19:00-21:00",
          ],
        },
      },
    ],
    experiences: {
      //Kinh nghiem và thành tích
      type: String,
    },
    sessionPrice: {
      type: Number,
      default: 50000,
    },
    avgRating: {
      //Danh gia trung binh
      type: Number,
      default: 0,
    },
    totalReviews: {
      //Tong so danh gia
      type: Number,
      default: 0,
    },
    totalStar: {
      //Tong so sao
      type: Number,
      default: 0,
    },
    totalSessions: {
      //Tong so buoi hoc
      type: Number,
      default: 0,
    },
    recentReviews: {
      //Danh sach danh gia gan day
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Review",
    },
    trustScore: {
      // Diem tin cay
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    completedSessions: {
      //Tong so buoi hoc da hoan thanh
      type: Number,
      default: 0,
    },
    consecutiveCompletedSessions: {
      type: Number,
      default: 0,
      // Số buổi học thành công liên tiếp
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tutor", tutorSchema);
