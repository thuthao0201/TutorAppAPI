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
      },
    },
  ],
  // schedule: [
  //   {
  //     day: {
  //       type: String,
  //     },
  //     time: {
  //       type: String,
  //     },
  //   },
  // ],
  // Ko can lich tuy chinh nua, chuyen sang lich co dinh
  // schedule: {
  //   type: Map, // Mỗi ngày sẽ có danh sách các ca học (VD: { "Monday": ["08:00-10:00", "14:00-16:00"] })
  //   of: [String], // Mỗi ngày sẽ có danh sách các ca đã nhận (VD: ["08:00-10:00", "14:00-16:00"])
  //   default: {},
  // },
  experiences: {
    //Kinh nghiem và thành tích
    type: String,
  },
  price: {
    type: Number,
    default: 50000,
  },
  avgRating: {
    //Danh gia trung binh
    type: Number,
    default: 0,
  },
  reviews: {
    //Danh sach danh gia
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Review",
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
});

module.exports = mongoose.model("Tutor", tutorSchema);
