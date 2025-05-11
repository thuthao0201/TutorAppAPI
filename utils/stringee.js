const jwt = require("jsonwebtoken");
const axios = require("axios");

/**
 * Get server Access Token from Stringee
 * @param {string} apiKeySid - The API Key SID
 * @param {string} apiKeySecret - The API Key Secret
 * @returns {string} - The generated server Access Token
 */
function getServerAccessToken(apiKeySid, apiKeySecret) {
  const payload = {
    jti: Math.random().toString(36).substring(2),
    iss: apiKeySid,
    exp: Math.floor(Date.now() / 1000) + 3600, // Token valid for 1 hour
    rest_api: true,
  };

  return jwt.sign(payload, apiKeySecret, { algorithm: "HS256" });
}

/**
 * Get room token for Stringee
 * @param {string} roomId - The room ID
 * @param {string} userId - The user ID
 * @param {string} role - The role of the user (publisher, subscriber, etc.)
 */
function getRoomToken(roomId, userId, role) {
  const payload = {
    roomId,
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + 7200, // Token valid for 2 hours
  };

  return jwt.sign(payload, process.env.STRINGEE_API_SECRET, {
    algorithm: "HS256",
    issuer: process.env.STRINGEE_API_KEY,
  });
}

/**
 * Create a new room in Stringee
 * @return {Promise<string>} - The room ID
 */
async function createRoom() {
  const response = await axios.post(
    "https://api.stringee.com/v1/room2/create",
    {
      name: `room_${Date.now()}`,
      expiresIn: 7200,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-STRINGEE-AUTH": getServerAccessToken(
          process.env.STRINGEE_API_KEY,
          process.env.STRINGEE_API_SECRET
        ),
      },
    }
  );

  if (response.data.r !== 0) {
    throw new Error("Failed to create room");
  }
  console.log("Room Response:", response.data);

  return response.data.roomId;
}

module.exports = {
  getServerAccessToken,
  getRoomToken,
  createRoom,
};
