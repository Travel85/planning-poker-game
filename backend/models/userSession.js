const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    sessionData: {
      lastActive: Date,
      isConnected: Boolean,
      // Any other session-specific data
    },
    userId: {
      type: String,
      required: true,
    },
    socketId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["productmanager", "developer", "observer"],
    },
    voteResult: String,
    hasVoted: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      expires: 10000, // 30 minutes in seconds
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Export the model
module.exports = mongoose.model("Poker-Session", userSchema);
