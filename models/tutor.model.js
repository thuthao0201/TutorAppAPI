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
        enum: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
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
  recentReviews: {
    //Danh sach danh gia gan day
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Review",
  },
  totalReviews: {
    //Tong so danh gia
    type: Number,
    default: 0,
  },
}, {timestamps: true});

module.exports = mongoose.model("Tutor", tutorSchema);
