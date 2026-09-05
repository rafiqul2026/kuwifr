// server/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required for OTPs & notifications'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
      // Removed unique: true so multiple accounts can share the same mobile number
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'],
      default: 'MEMBER'
    },
    status: {
      type: String,
      enum: ['INACTIVE', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'BLOCKED'],
      default: 'INACTIVE'
    },
    profileImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    kyc: {
      status: {
        type: String,
        enum: ['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'],
        default: 'NOT_SUBMITTED'
      },
      aadhaarNumber: { type: String, default: '' },
      panNumber: { type: String, default: '' },
      aadhaarFront: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
      aadhaarBack: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
      panCard: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
      rejectionReason: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null }
    },
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    referralCode: {
      type: String,
      unique: true,
      required: true
    },
    directReferrals: {
      type: Number,
      default: 0
    },
    binaryParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    binarySide: {
      type: String,
      enum: ['left', 'right', 'root'],
      default: 'root'
    },
    activePackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      default: null
    },
    currentRankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rank',
      default: null
    },
    activationDate: {
      type: Date,
      default: null
    },
    totalKBP: { type: Number, default: 0 },
    lifetimeIncome: { type: Number, default: 0 },
    directIncome: { type: Number, default: 0 },
    matchingIncome: { type: Number, default: 0 },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      panNumber: String,
      upiId: String
    },
    otp: {
      type: String,
      default: null,
      select: false
    },
    otpExpires: {
      type: Date,
      default: null,
      select: false
    },
    lastLogin: {
      type: Date,
      default: null
    },
    registrationIP: String,
    userAgent: String,
    joinedDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.statics.generateMemberId = async function () {
  let isUnique = false;
  let customId = '';
  while (!isUnique) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    customId = `KFR${randomDigits}`;
    const existing = await this.findOne({ memberId: customId });
    if (!existing) isUnique = true;
  }
  return customId;
};

UserSchema.methods.generateOTP = function () {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otpCode;
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  return otpCode;
};

const User = mongoose.model('User', UserSchema);
module.exports = User;