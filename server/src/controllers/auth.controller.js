// server/src/controllers/auth.controller.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Referral = require("../models/Referral");
const BinaryNode = require("../models/BinaryNode");
const BinaryService = require("../services/binary.service");
const EmailService = require("../services/email.service");

// tokenVersion defaults to 0 for every existing call site that doesn't pass
// one — matches the auth middleware's own (decoded.tokenVersion || 0)
// fallback, so this change never invalidates a token that was already
// valid before tokenVersion existed.
const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const setTokenCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

async function getReferralChainForUser(userId) {
  const chain = [];
  let currentId = userId;
  let level = 0;

  while (currentId && level < 10) {
    const user = await User.findById(currentId);
    if (!user) break;
    chain.push(user);
    currentId = user.sponsorId;
    level++;
  }
  return chain;
}

// ============ REGISTRATION (IDEMPOTENT & MULTI-ACCOUNT FRIENDLY) ============
const register = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      password,
      sponsorId,
      side,
      binarySide,
      position,
      pos,
    } = req.body;

    const cleanEmail = email ? email.toLowerCase().trim() : "";
    const cleanPhone = phoneNumber ? phoneNumber.trim() : "";

    if (!fullName || !cleanEmail || !cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message:
          "All fields (Full Name, Email, Phone Number, Password) are required.",
      });
    }

    // Business rule: every new member joins under a sponsor — there is no
    // such thing as self-registration into an unlinked spot on this plan.
    // RegisterPage.jsx already makes Sponsor ID a required field (pre-filled
    // and locked when arriving via a referral link, editable otherwise);
    // this is the real guard, since the client check alone is bypassable
    // with a direct API call.
    if (!sponsorId || !String(sponsorId).trim()) {
      return res.status(400).json({
        success: false,
        message: "Sponsor ID is required. Every new member must join under a sponsor.",
      });
    }

    const generatedMemberId = await User.generateMemberId();

    const user = new User({
      memberId: generatedMemberId,
      referralCode: generatedMemberId,
      fullName: fullName.trim(),
      email: cleanEmail,
      phoneNumber: cleanPhone,
      password,
      registrationIP: req.ip,
      userAgent: req.headers["user-agent"],
      status: "INACTIVE",
      activePackageId: null,
      activationDate: null,
    });

    if (sponsorId) {
      const cleanSponsorInput = sponsorId.trim();
      const sponsor = await User.findOne({
        $or: [
          { memberId: { $regex: new RegExp(`^${cleanSponsorInput}$`, "i") } },
          {
            referralCode: { $regex: new RegExp(`^${cleanSponsorInput}$`, "i") },
          },
        ],
      });

      if (!sponsor) {
        return res.status(404).json({
          success: false,
          message: "Sponsor User ID not found or invalid.",
        });
      }

      if (["SUSPENDED", "BLOCKED", "DEACTIVATED"].includes(sponsor.status)) {
        return res.status(400).json({
          success: false,
          message: "Sponsor account is suspended or inactive.",
        });
      }

      const inputSide = (
        binarySide ||
        position ||
        side ||
        (pos === "R" ? "right" : "left")
      ).toLowerCase();
      user.sponsorId = sponsor._id;
      user.binarySide = inputSide === "right" ? "right" : "left";
    }

    // Save user safely
    await user.save();

    // 10-level Unilevel genealogy (Defensive upsert)
    if (user.sponsorId) {
      // IMPORTANT: binary tree placement must NOT live inside this same
      // try/catch as the Referral genealogy writes below. It used to, and
      // that was the root cause of members registering successfully with a
      // correct User.binarySide (so their "Position" pill on the Team page
      // showed L/R correctly) while never actually being linked into
      // BinaryNode.leftChildId/rightChildId — which is what the Growth
      // Generation tree, "Total Downline Left/Right" counts, and KBP/
      // matching-income calculations all read from. Any throw in the
      // Referral loop or the directReferrals $inc below (e.g. a transient
      // DB hiccup, or exactly the kind of silent Referral-collection
      // failure documented in downline.service.js) would skip line 159's
      // placeMember call entirely, leaving that member's whole downline
      // invisible to the binary tree forever with no error surfaced beyond
      // a generic "Genealogy linking notice" log. Running it in its own,
      // independent try/catch means a Referral-write failure can never
      // again prevent binary placement (and vice versa).
      try {
        const chain = await getReferralChainForUser(user.sponsorId);
        for (let i = 0; i < chain.length && i < 10; i++) {
          const sponsor = chain[i];
          const level = i + 1;

          await Referral.findOneAndUpdate(
            { sponsorId: sponsor._id, userId: user._id },
            {
              $set: {
                level: level,
                parentId: i === 0 ? user.sponsorId : chain[i - 1]._id,
                path: chain
                  .slice(0, i + 1)
                  .map((s) => s._id.toString())
                  .join("-"),
                isActive: false,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }

        await User.findByIdAndUpdate(user.sponsorId, {
          $inc: { directReferrals: 1 },
        });
      } catch (genealogyErr) {
        console.error("Genealogy linking notice:", genealogyErr.message);
      }

      // Registration itself must still succeed even if binary placement
      // hits an unexpected error (we don't want a tree glitch to block
      // account creation) — but a silent console.error here is easy to
      // miss, and a member left unplaced shows up later as a confusing
      // "why is my Growth Generation tree empty" support question with
      // no obvious cause. Log it loudly and unmistakably so it's actually
      // noticed, and remember the failure can be corrected afterward via
      // POST /api/admin/binary/repair (BinaryService.repairAllPlacements)
      // without needing to touch this user's account again. This now runs
      // UNCONDITIONALLY on its own — no longer gated on the Referral writes
      // above having succeeded.
      await BinaryService.placeMember(
        user._id,
        user.sponsorId,
        user.binarySide
      ).catch((err) => {
        console.error(
          `\n🚨 BINARY PLACEMENT FAILED for new member ${user.memberId} (${user._id}): ${err.message}\n` +
          `   This member's account was created successfully, but they are NOT linked into the binary tree.\n` +
          `   Fix with: POST /api/admin/binary/repair (safe, non-destructive, can be run any time).\n`
        );
      });
    } else {
      await BinaryNode.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            parentId: null,
            position: "root",
            level: 1,
            leftChildId: null,
            rightChildId: null,
            leftVolume: 0,
            rightVolume: 0,
            matchingVolume: 0,
            availableLeftVolume: 0,
            availableRightVolume: 0,
            pairCount: 0,
            totalKBP: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch(() => {});
    }

    // Create Wallet safely (Idempotent upsert)
    await Wallet.findOneAndUpdate(
      { userId: user._id },
      {
        $setOnInsert: {
          incomeBalance: 0,
          repurchaseBalance: 0,
          totalIncome: 0,
          totalWithdrawn: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => {});

    const token = generateToken(user._id, user.tokenVersion || 0);
    setTokenCookie(res, token);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: `Account created successfully! Your User ID is ${user.memberId}. Status: INACTIVE (Purchase a package to activate).`,
      data: {
        token,
        memberId: user.memberId,
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || "Field";
      // If user was already saved, don't fail registration
      if (duplicateField === "userId") {
        return res.status(201).json({
          success: true,
          message: "Account created successfully!",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Database constraint conflict detected on (${duplicateField}). Please try again.`,
      });
    }

    next(error);
  }
};

// ============ MEMBER-INITIATED DOWNLINE REGISTRATION (Growth Generation "Open Spot") ============
// The public register() above is built for a logged-out visitor: it issues
// a token/cookie for the NEW account, which would silently swap a logged-in
// member's session to the person they just registered. This is the
// authenticated counterpart used when a member clicks an "Open Spot" on
// their Growth Generation tree — sponsor is always the caller, the new
// member is placed at that exact spot (not the extreme-leg spillover
// register() uses), and no token is issued for the new account.

// GET /api/auth/register-downline/spot?parent=KFR...&side=left|right
const getDownlineSpotInfo = async (req, res, next) => {
  try {
    const spot = await BinaryService.validateOpenSpot(req.userId, req.query.parent, req.query.side);
    if (!spot.ok) {
      return res.status(spot.status).json({ success: false, message: spot.message });
    }
    res.json({
      success: true,
      data: {
        side: spot.side,
        parent: { memberId: spot.parentUser.memberId, fullName: spot.parentUser.fullName },
        sponsor: { memberId: req.user.memberId, fullName: req.user.fullName }
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/register-downline
const registerDownlineMember = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password, placementParentId, side } = req.body;

    const cleanEmail = email ? String(email).toLowerCase().trim() : "";
    const cleanPhone = phoneNumber ? String(phoneNumber).trim() : "";

    if (!fullName || !String(fullName).trim() || !cleanEmail || !cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields (Full Name, Email, Phone Number, Password) are required.",
      });
    }
    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const sponsor = req.user;
    const spot = await BinaryService.validateOpenSpot(sponsor._id, placementParentId, side);
    if (!spot.ok) {
      return res.status(spot.status).json({ success: false, message: spot.message });
    }

    const generatedMemberId = await User.generateMemberId();
    const user = new User({
      memberId: generatedMemberId,
      referralCode: generatedMemberId,
      fullName: String(fullName).trim(),
      email: cleanEmail,
      phoneNumber: cleanPhone,
      password,
      registrationIP: req.ip,
      userAgent: req.headers["user-agent"],
      status: "INACTIVE",
      activePackageId: null,
      activationDate: null,
      sponsorId: sponsor._id,
      binarySide: spot.side,
    });
    await user.save();

    try {
      await BinaryService.placeMemberAtSpot(user._id, spot);
    } catch (placeErr) {
      // Never leave an account that isn't linked into the tree it was
      // supposed to be created in.
      await User.deleteOne({ _id: user._id }).catch(() => {});
      if (placeErr.code === "SPOT_TAKEN") {
        return res.status(409).json({ success: false, message: placeErr.message });
      }
      throw placeErr;
    }

    try {
      const chain = await getReferralChainForUser(user.sponsorId);
      for (let i = 0; i < chain.length && i < 10; i++) {
        const chainSponsor = chain[i];
        await Referral.findOneAndUpdate(
          { sponsorId: chainSponsor._id, userId: user._id },
          {
            $set: {
              level: i + 1,
              parentId: i === 0 ? user.sponsorId : chain[i - 1]._id,
              path: chain.slice(0, i + 1).map((s) => s._id.toString()).join("-"),
              isActive: false,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      await User.findByIdAndUpdate(user.sponsorId, { $inc: { directReferrals: 1 } });
    } catch (genealogyErr) {
      console.error("Genealogy linking notice:", genealogyErr.message);
    }

    await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { incomeBalance: 0, repurchaseBalance: 0, totalIncome: 0, totalWithdrawn: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Member registered successfully! User ID: ${user.memberId}.`,
      data: {
        memberId: user.memberId,
        fullName: user.fullName,
        placement: {
          parentMemberId: spot.parentUser.memberId,
          parentName: spot.parentUser.fullName,
          side: spot.side,
        },
      },
    });
  } catch (error) {
    console.error("Downline registration error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A member with this email or phone number already exists.",
      });
    }
    next(error);
  }
};

// ============ LOGIN ============
const login = async (req, res, next) => {
  try {
    const inputIdentifier =
      req.body.userId || req.body.email || req.body.memberId;
    const password = req.body.password;

    if (!inputIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide your User ID (e.g. KFR123456) and Password",
      });
    }

    const cleanInput = inputIdentifier.trim();
    const user = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, "i") } },
        { referralCode: { $regex: new RegExp(`^${cleanInput}$`, "i") } },
      ],
    }).select("+password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid User ID or Password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid User ID or Password" });
    }

    if (["SUSPENDED", "DEACTIVATED", "BLOCKED"].includes(user.status)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Account is suspended or deactivated. Please contact support.",
        });
    }

    if (user.status === "PENDING_VERIFICATION") {
      user.status = "INACTIVE";
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id, user.tokenVersion || 0);
    setTokenCookie(res, token);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "Login successful",
      data: { token, user: userResponse },
    });
  } catch (error) {
    next(error);
  }
};

// ============ REFRESH TOKEN ============
const refreshToken = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No session token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({
          success: false,
          message: "Session expired. Please log in again.",
        });
    }

    const user = await User.findById(decoded.userId)
      .populate("activePackageId", "name type price kbp dailyCap")
      .populate("sponsorId", "fullName memberId");

    if (
      !user ||
      ["SUSPENDED", "BLOCKED", "DEACTIVATED"].includes(user.status)
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "User account is not active or has been disabled.",
        });
    }

    const newToken = generateToken(user._id, user.tokenVersion || 0);
    setTokenCookie(res, newToken);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ success: true, data: { token: newToken, user: userResponse } });
  } catch (error) {
    next(error);
  }
};

// ============ SEND FORGOT PASSWORD OTP ============
const sendForgotPasswordOTP = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide your registered User ID",
        });
    }

    const cleanInput = identifier.trim();
    const user = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, "i") } },
        { referralCode: { $regex: new RegExp(`^${cleanInput}$`, "i") } },
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No account found with this User ID",
        });
    }

    const otpCode = user.generateOTP();
    await user.save();

    try {
      await EmailService.sendEmail({
        to: user.email,
        subject: `🔐 Your KUWIFR Password Reset OTP: ${otpCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2>Password Reset Request</h2>
            <p>Hello <strong>${user.fullName}</strong>,</p>
            <p>Your 6-digit One Time Password (OTP) to reset your password is:</p>
            <div style="font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: 4px; margin: 20px 0;">
              ${otpCode}
            </div>
            <p>This OTP is valid for 10 minutes.</p>
          </div>
        `,
        text: `Your KUWIFR Password Reset OTP is ${otpCode}. Valid for 10 minutes.`,
      });
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr);
    }

    res.json({
      success: true,
      message: `A 6-digit OTP has been sent to your registered email (${user.email.replace(/(.{2})(.*)(?=@)/, "$1***")}).`,
      data: { emailMasked: user.email.replace(/(.{2})(.*)(?=@)/, "$1***") },
    });
  } catch (error) {
    next(error);
  }
};

// ============ RESET PASSWORD WITH OTP ============
const resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide User ID, OTP, and New Password",
        });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
    }

    const cleanInput = identifier.trim();
    const user = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, "i") } },
        { referralCode: { $regex: new RegExp(`^${cleanInput}$`, "i") } },
      ],
      otp: otp.trim(),
      otpExpires: { $gt: new Date() },
    }).select("+password");

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid or expired OTP. Please request a new OTP.",
        });
    }

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({
      success: true,
      message:
        "Password reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// ============ SEND CHANGE PASSWORD OTP ============
const sendChangePasswordOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const otpCode = user.generateOTP();
    await user.save();

    try {
      await EmailService.sendEmail({
        to: user.email,
        subject: `🔐 KUWIFR Password Change OTP: ${otpCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2>Change Password Verification</h2>
            <p>Your OTP to verify password change is:</p>
            <div style="font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: 4px; margin: 20px 0;">
              ${otpCode}
            </div>
          </div>
        `,
        text: `Your KUWIFR Password Change OTP is ${otpCode}`,
      });
    } catch (emailErr) {
      console.error("Failed to send Change Password OTP email:", emailErr);
    }

    res.json({ success: true, message: `OTP sent to ${user.email}` });
  } catch (error) {
    next(error);
  }
};

// ============ CHANGE PASSWORD WITH OTP ============
const changePasswordWithOTP = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: "Current Password, New Password, and OTP are required",
      });
    }

    const user = await User.findOne({
      _id: userId,
      otp: otp.trim(),
      otpExpires: { $gt: new Date() },
    }).select("+password");

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ success: true, message: "Password changed successfully!" });
  } catch (error) {
    next(error);
  }
};

// ============ CHANGE PASSWORD (direct — current password only, no OTP) ============
// The Member Profile page's password-change control used to be a pure UI
// stub: clicking it just showed a static "Password reset link sent..."
// toast and called nothing. This is the real endpoint behind its
// replacement — a standard logged-in "enter current password, set a new
// one" form, no OTP step (that flow already exists separately for Forgot
// Password / the Admin panel's OTP-based change-password, both untouched).
//
// "Sign me out of all other devices": JWTs are stateless, so there's no
// session to individually revoke — instead this bumps the user's
// tokenVersion, which the auth middleware compares against every
// subsequent request's token. Every token issued before this call now
// fails that check and is rejected, while THIS request's own new token
// (returned in the response, embedding the just-bumped tokenVersion) keeps
// the current session logged in.
const changePasswordDirect = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, signOutOtherDevices } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    if (signOutOtherDevices) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }
    await user.save();

    const responseData = {};
    if (signOutOtherDevices) {
      const freshToken = generateToken(user._id, user.tokenVersion);
      setTokenCookie(res, freshToken);
      responseData.token = freshToken;
    }

    res.json({
      success: true,
      message: signOutOtherDevices
        ? "Password changed. You've been signed out of all other devices."
        : "Password changed successfully!",
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

// ============ LOGOUT ============
const logout = async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ success: true, message: "Logged out successfully" });
};

// ============ CURRENT AUTHENTICATED USER ============
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
      .populate("activePackageId", "name type price kbp dailyCap")
      .populate("sponsorId", "fullName memberId");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ success: true, data: { user: userResponse } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  sendForgotPasswordOTP,
  resetPasswordWithOTP,
  sendChangePasswordOTP,
  changePasswordWithOTP,
  changePasswordDirect,
  registerDownlineMember,
  getDownlineSpotInfo,
};