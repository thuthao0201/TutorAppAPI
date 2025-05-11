const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const db = require("./configs/db");
const morgan = require("morgan");
dotenv.config();

const { getServerAccessToken } = require("./utils/stringee");
const jwt = require("jsonwebtoken");
const axios = require("axios");

db.connect();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use("/uploads", express.static(__dirname + "/uploads"));

// app.post("/video/token", async (req, res) => {
//   const { userId, roomId: clientRoomId } = req.body;

//   try {
//     let roomId = clientRoomId;

//     // Nếu không có roomId từ client, tạo mới room
//     if (!roomId) {
//       const roomResponse = await axios.post(
//         "https://api.stringee.com/v1/room2/create",
//         {
//           name: `room_${Date.now()}`,
//           expiresIn: 3600,
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//             "X-STRINGEE-AUTH": getServerAccessToken(
//               process.env.STRINGEE_API_KEY,
//               process.env.STRINGEE_API_SECRET
//             ),
//           },
//         }
//       );

//       console.log("Room Response:", roomResponse.data);

//       if (roomResponse.data.r !== 0) {
//         return res.status(500).json({ error: "Failed to create room" });
//       }

//       roomId = roomResponse.data.roomId;
//     }

//     // Tạo roomToken bằng JWT
//     const payload = {
//       roomId,
//       userId,
//       role: "publisher", // hoặc 'admin', 'subscriber'
//       exp: Math.floor(Date.now() / 1000) + 3600,
//     };

//     const roomToken = jwt.sign(payload, process.env.STRINGEE_API_SECRET, {
//       algorithm: "HS256",
//       issuer: process.env.STRINGEE_API_KEY,
//     });

//     res.json({ roomId, roomToken });
//   } catch (error) {
//     console.error("Error:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

app.use("/", require("./routes/index.route"));

app.listen(3000, () => {
  console.log("Server is running at port 3000");
});
