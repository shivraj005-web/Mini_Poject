const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    // User's prioritized weights for the 12 indicators
    preferences: {
      type: Map,
      of: Number,
      default: {}
    },
    activePreset: {
      type: String,
      default: null
    },
    preferredRegion: {
      type: String,
      default: "All"
    },
    preferredYear: {
      type: Number,
      default: 2026
    },
    // The user's selected suitable country
    selectedCountry: {
      country: { type: String, default: null },
      region: { type: String, default: null },
      matchScore: { type: Number, default: null },
      rank: { type: Number, default: null },
      savedAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static helper to hash password
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainPassword, salt);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
