const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // User Preferences
    preferences: {
      aiAnalysisEnabled: {
        type: Boolean,
        default: true,
      },
      autoTagging: {
        type: Boolean,
        default: true,
      },
      connectionThreshold: {
        type: Number,
        default: 0.7,
        min: 0.5,
        max: 0.95,
      },
    },

    // Usage Statistics
    stats: {
      totalItems: {
        type: Number,
        default: 0,
      },
      itemsByType: {
        text: { type: Number, default: 0 },
        image: { type: Number, default: 0 },
        audio: { type: Number, default: 0 },
        web_clip: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", UserSchema);
