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
      // 🚫 NO unique: true -> Multiple accounts per email allowed
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
      // 🚫 NO unique: true -> Multiple accounts per phone number allowed
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
      panNumber: { 
        type: String, 
        default: '',
        uppercase: true,
        trim: true
        // 🌟 Uniqueness check handled in submitKYC controller to prevent registration errors
      },
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
    // Denormalized display/fallback fields written by the package purchase
    // and cash-activation flows. Several places (salary.service.js,
    // user.controller.js) read `currentPackage` as a fallback when
    // activePackageId isn't populated — these were previously undeclared,
    // so Mongoose's default strict mode silently dropped every write to
    // them and the fallback always read back empty.
    currentPackage: { type: String, default: null },
    packagePrice: { type: Number, default: 0 },
    dailyBinaryCap: { type: Number, default: 0 },
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
    },
    // Per-admin read/clear state for the Admin Alerts inbox
    // (adminAlerts.service.js). Only ever populated on ADMIN/SUPER_ADMIN
    // accounts. alertsReadAt: alerts created at-or-before this timestamp
    // render as "read". clearedAlertIds: individually dismissed alerts
    // (synthetic ids like "signup:<userId>"), capped so this array can
    // never grow unbounded.
    adminAlertsReadAt: {
      type: Date,
      default: null
    },
    clearedAlertIds: {
      type: [String],
      default: []
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

// Business rule (stated explicitly by the product owner): a member's ID is
// ACTIVE only if they have actually purchased a package; with no verified
// package on file, they must show INACTIVE. This has been violated in
// practice — package.controller.js#purchasePackage used to be able to flip
// status to ACTIVE via a hardcoded-package fallback that never resolved to
// a real Package document, leaving a member ACTIVE with no activePackageId
// at all ("No Active Package" shown right next to an ACTIVE badge).
//
// Every activation code path has now been fixed to always set
// activePackageId in the same write as status, but rather than trust every
// current AND future call site to keep doing that correctly, enforce it
// here as a hard guarantee: no save can WRITE a MEMBER into that impossible
// state, from any code path, ever again. (Scoped to role MEMBER only —
// ADMIN/SUPER_ADMIN accounts are legitimately ACTIVE with no package.)
//
// IMPORTANT — this must only block the save that actually CREATES the bad
// combination, not every future save on a record that already has it. A
// member who was already left in this state by the old bug (before this
// guard existed) still needs to be able to log in, have lastLogin touched,
// edit their profile, submit KYC, etc. — none of those saves modify status
// or activePackageId. Checking only this.status/this.activePackageId
// unconditionally would re-reject EVERY save on that record forever,
// including login itself (auth.controller.js sets user.lastLogin and
// calls user.save() on every successful login) — which is exactly what
// happened: an already-orphaned member became unable to log in at all once
// this guard shipped. isModified() scopes the check to saves that are
// actually touching one of these two fields (or creating a brand-new
// document), so an existing bad record stays reachable and fixable via
// POST /api/admin/members/fix-orphaned-active-status (or the standalone
// scripts/fix-orphaned-active-status.js) instead of being locked out.
UserSchema.pre('save', function (next) {
  const invalid = this.role === 'MEMBER' && this.status === 'ACTIVE' && !this.activePackageId;
  const touchedRelevantFields = this.isNew || this.isModified('status') || this.isModified('activePackageId');

  if (invalid && touchedRelevantFields) {
    return next(new Error(
      'Business rule violation: a member cannot be set to ACTIVE status without a valid activePackageId ' +
      '(a real, purchased package). Resolve the package first, then set status and activePackageId together.'
    ));
  }
  next();
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
    const existing = await this.findOne({
      $or: [{ memberId: customId }, { referralCode: customId }]
    });
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