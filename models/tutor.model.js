const mongoose = require("mongoose");

const tutorSchema = new mongoose.Schema({
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
    //Chuyen nganh: vi du: nganh giao duc, nganh y
    type: String,
  },
  degree: {
    //Hoc vi: vi du: thac si, cu nhan
    type: String,
  },
  hasCertificate: {
    //Da cung cap chung chi cho trung tam chua
    type: Boolean,
    default: false,
  },
  subjects: [
    {
      name: {
        type: String,
      },
      grades: {
        type: [String],
        enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
      }
    },
  ],
  availableSchedule: [
    {
      day: {
        type: String,
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      },
      timeSlots: {
        type: [String],
        enum: ["7:00-9:00", "9:30-11:30", "13:00-15:00", "15:30-17:30", "19:00-21:00"],
      },
    }
  ],
  experiences: {
    //Kinh nghiem và thành tích
    type: String,
  },
  classPrice: {
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
  recentReviews: {
    //Danh sach danh gia gan day
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Review",
  },
  trustScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
  },
  completedClasses: {
    // Tong so buoi hoc da hoan thanh
    type: Number,
    default: 0,
  },
  consecutiveCompletedClasses: {
    type: Number,
    default: 0,
    // Số buổi học thành công liên tiếp
  },
}, {timestamps: true});

module.exports = mongoose.model("Tutor", tutorSchema);
