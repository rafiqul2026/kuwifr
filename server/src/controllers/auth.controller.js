// server/src/controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Referral = require('../models/Referral');
const BinaryNode = require('../models/BinaryNode');
const BinaryService = require('../services/binary.service');
const EmailService = require('../services/email.service');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
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

// ============ REGISTRATION ============
const register = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password, sponsorId, side, binarySide, position, pos } = req.body;

    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanPhone = phoneNumber ? phoneNumber.trim() : '';

    // Generate unique Member ID
    const generatedMemberId = await User.generateMemberId();

    const user = new User({
      memberId: generatedMemberId,
      referralCode: generatedMemberId,
      fullName: fullName.trim(),
      email: cleanEmail,
      phoneNumber: cleanPhone,
      password,
      registrationIP: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'INACTIVE',
      activePackageId: null,
      activationDate: null
    });

    if (sponsorId) {
      const cleanSponsorInput = sponsorId.trim();
      const sponsor = await User.findOne({
        $or: [
          { memberId: { $regex: new RegExp(`^${cleanSponsorInput}$`, 'i') } },
          { referralCode: { $regex: new RegExp(`^${cleanSponsorInput}$`, 'i') } },
          { email: cleanSponsorInput.toLowerCase() },
          { phoneNumber: cleanSponsorInput }
        ]
      });

      if (!sponsor) {
        return res.status(404).json({
          success: false,
          message: 'Sponsor User ID not found or invalid.'
        });
      }

      if (sponsor.status === 'SUSPENDED' || sponsor.status === 'BLOCKED' || sponsor.status === 'DEACTIVATED') {
        return res.status(400).json({
          success: false,
          message: 'Sponsor account is suspended or inactive.'
        });
      }

      const inputSide = (binarySide || position || side || (pos === 'R' ? 'right' : 'left')).toLowerCase();
      user.sponsorId = sponsor._id;
      user.binarySide = inputSide === 'right' ? 'right' : 'left';
    }

    await user.save();

    // Link 10-level unilevel genealogy
    if (user.sponsorId) {
      const chain = await getReferralChainForUser(user.sponsorId);
      for (let i = 0; i < chain.length && i < 10; i++) {
        const sponsor = chain[i];
        const level = i + 1;
        const existingRef = await Referral.findOne({
          sponsorId: sponsor._id,
          userId: user._id
        });

        if (!existingRef) {
          await Referral.create({
            sponsorId: sponsor._id,
            userId: user._id,
            level: level,
            parentId: i === 0 ? user.sponsorId : chain[i - 1]._id,
            path: chain.slice(0, i + 1).map((s) => s._id).join('-'),
            isActive: false
          });
        }
      }

      await User.findByIdAndUpdate(user.sponsorId, {
        $inc: { directReferrals: 1 }
      });

      try {
        await BinaryService.placeMember(user._id, user.sponsorId, user.binarySide);
      } catch (error) {
        console.error('Binary placement notice:', error.message);
      }
    } else {
      const rootNode = new BinaryNode({
        userId: user._id,
        parentId: null,
        position: 'root',
        level: 1,
        leftChildId: null,
        rightChildId: null,
        leftVolume: 0,
        rightVolume: 0,
        matchingVolume: 0,
        availableLeftVolume: 0,
        availableRightVolume: 0,
        pairCount: 0,
        totalKBP: 0
      });
      await rootNode.save();
    }

    const wallet = new Wallet({
      userId: user._id,
      incomeBalance: 0,
      repurchaseBalance: 0,
      totalIncome: 0,
      totalWithdrawn: 0
    });
    await wallet.save();

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: `Account created successfully! Your User ID is ${user.memberId}. Status: INACTIVE (Purchase a package to activate).`,
      data: {
        token,
        memberId: user.memberId,
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

// ============ LOGIN ============
const login = async (req, res, next) => {
  try {
    const inputIdentifier = req.body.userId || req.body.email || req.body.memberId;
    const password = req.body.password;

    if (!inputIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your User ID (e.g. KFR123456) and Password'
      });
    }

    const cleanInput = inputIdentifier.trim();

    const user = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
        { referralCode: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
        { email: cleanInput.toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid User ID or Password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid User ID or Password'
      });
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED' || user.status === 'BLOCKED') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or deactivated. Please contact support.'
      });
    }

    if (user.status === 'PENDING_VERIFICATION') {
      user.status = 'INACTIVE';
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: userResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ REFRESH TOKEN ============
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No session token provided'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.'
      });
    }

    const user = await User.findById(decoded.userId)
      .populate('activePackageId', 'name type price kbp dailyCap')
      .populate('sponsorId', 'fullName memberId');

    if (!user || user.status === 'SUSPENDED' || user.status === 'BLOCKED' || user.status === 'DEACTIVATED') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active or has been disabled.'
      });
    }

    const newToken = generateToken(user._id);
    setTokenCookie(res, newToken);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      data: {
        token: newToken,
        user: userResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ SEND FORGOT PASSWORD OTP ============
const sendForgotPasswordOTP = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered User ID or Email address'
      });
    }

    const cleanInput = identifier.trim();
    const user = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
        { email: cleanInput.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this User ID or Email'
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
            <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
        text: `Your KUWIFR Password Reset OTP is ${otpCode}. It is valid for 10 minutes.`
      });
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr);
    }

    res.json({
      success: true,
      message: `A 6-digit OTP has been sent to your registered email (${user.email.replace(/(.{2})(.*)(?=@)/, '$1***')}).`,
      data: {
        emailMasked: user.email.replace(/(.{2})(.*)(?=@)/, '$1***')
      }
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
      return res.status(400).json({
        success: false,
        message: 'Please provide User ID/Email, OTP, and New Password'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const cleanInput = identifier.trim();
    const user = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
        { email: cleanInput.toLowerCase() }
      ],
      otp: otp.trim(),
      otpExpires: { $gt: new Date() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new OTP.'
      });
    }

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

// ============ SEND CHANGE PASSWORD OTP ============
const sendChangePasswordOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otpCode = user.generateOTP();
    await user.save();

    try {
      await EmailService.sendEmail({
        to: user.email,
        subject: `🔐 KUWIFR Password Change OTP: ${otpCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2>Change Password Verification</h2>
            <p>Hello <strong>${user.fullName}</strong>,</p>
            <p>Your OTP to verify password change is:</p>
            <div style="font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: 4px; margin: 20px 0;">
              ${otpCode}
            </div>
            <p>Valid for 10 minutes. Do not share this OTP with anyone.</p>
          </div>
        `,
        text: `Your KUWIFR Password Change OTP is ${otpCode}`
      });
    } catch (emailErr) {
      console.error('Failed to send Change Password OTP email:', emailErr);
    }

    res.json({
      success: true,
      message: `OTP sent to ${user.email}`
    });
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
        message: 'Current Password, New Password, and OTP are required'
      });
    }

    const user = await User.findOne({
      _id: userId,
      otp: otp.trim(),
      otpExpires: { $gt: new Date() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully!'
    });
  } catch (error) {
    next(error);
  }
};

// ============ LOGOUT ============
const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

// ============ CURRENT AUTHENTICATED USER ============
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
      .populate('activePackageId', 'name type price kbp dailyCap')
      .populate('sponsorId', 'fullName memberId');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

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
  changePasswordWithOTP
};