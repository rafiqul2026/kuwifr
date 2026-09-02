// server/src/routes/bonanza.routes.js
const express = require('express');
const router = express.Router();
const Bonanza = require('../models/Bonanza');
const User = require('../models/User');
const BinaryNode = require('../models/BinaryNode');
const { auth } = require('../middleware/auth');

router.get('/active', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fetch active and upcoming bonanzas
    let bonanzas = await Bonanza.find({
      status: { $in: ['ACTIVE', 'UPCOMING'] }
    }).sort({ startDate: 1 });

    // Fallback if no campaign has been created in DB yet
    if (bonanzas.length === 0) {
      bonanzas = [
        {
          _id: 'default-digha',
          title: 'Digha Coastal Retreat Tour',
          periodType: 'Monthly',
          startDate: new Date('2026-09-15T00:00:00.000Z'),
          endDate: new Date('2026-10-15T23:59:59.000Z'),
          targetIncome: 20000,
          destination: 'Digha Sea Beach, West Bengal',
          coverageDetails:
            'KUWIFR SERVICES PVT LTD will provide all travel & hospitality expenses from the nearby railway station to the targeted spot (including lodging, meals, and local transit).',
          image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
          status: 'ACTIVE'
        }
      ];
    }

    // Direct Referral Income
    const directIncome = user.directIncome || user.referralIncome || (user.directReferrals ? user.directReferrals * 500 : 0);

    // Binary Matching Income
    const binaryNode = await BinaryNode.findOne({ userId });
    const matchingIncome = binaryNode?.matchingVolume ? binaryNode.matchingVolume * 0.10 : (user.matchingIncome || 0);

    // Total Qualification = Direct + Matching
    const totalQualifyingIncome = directIncome + matchingIncome;

    res.json({
      success: true,
      data: {
        bonanzas,
        userStats: {
          directIncome,
          matchingIncome,
          qualifyingIncome: totalQualifyingIncome
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;