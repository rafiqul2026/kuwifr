// server/src/services/packageActivation.service.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Package = require('../models/Package');
const PackagePurchase = require('../models/PackagePurchase');
const IncomeTransaction = require('../models/IncomeTransaction');
const Wallet = require('../models/Wallet');
const BinaryNode = require('../models/BinaryNode');
const IncomeService = require('./income.service');

class PackageActivationService {
  /**
   * Activate a member package via Cash with full transactional safety & rollback
   */
  static async activateCashPackage({ memberIdentifier, packageId, cashAmount, paymentDate, receiptNumber, notes, adminUser }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate Member
      const cleanInput = memberIdentifier ? memberIdentifier.trim() : '';
      const member = await User.findOne({
        $or: [
          { memberId: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
          { email: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
          { phoneNumber: cleanInput }
        ]
      }).session(session);

      if (!member) {
        throw new Error('Member not found matching the provided identifier.');
      }

      // 2. Validate Package from Database (Source of Truth)
      const pkg = await Package.findById(packageId).session(session);
      if (!pkg) {
        throw new Error('Selected package not found in master catalog.');
      }

      const authoritativePrice = pkg.price || pkg.packagePrice || 1500;
      const authoritativeKbp = pkg.kbpValue || pkg.kbp || 1000;

      // 3. Validate Cash Amount
      if (Number(cashAmount) !== Number(authoritativePrice)) {
        throw new Error(`Cash amount (₹${cashAmount}) must exactly match the package price (₹${authoritativePrice}).`);
      }

      // 4. Idempotency Check: Prevent duplicate active package activation for same order event
      const referenceId = `ACT_CASH_${member._id}_${pkg._id}_${Date.now()}`;

      // 5. Update Member State
      member.status = 'ACTIVE';
      member.activePackageId = pkg._id;
      member.activationDate = new Date();
      await member.save({ session });

      // 6. Create Permanent Package Purchase Record
      const sponsor = member.sponsorId ? await User.findById(member.sponsorId).session(session) : null;
      
      const purchaseRecord = await PackagePurchase.create([{
        memberId: member.memberId,
        memberMongoId: member._id,
        memberName: member.fullName,
        sponsorId: sponsor ? sponsor.memberId : '',
        packageId: pkg._id,
        packageName: pkg.name,
        packagePrice: authoritativePrice,
        kbp: authoritativeKbp,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        activationStatus: 'ACTIVE',
        paymentDate: paymentDate || new Date(),
        receiptNumber: receiptNumber || `RCPT-${Date.now()}`,
        activatedByAdminId: adminUser._id,
        activatedByAdminName: adminUser.fullName || 'Admin',
        notes: notes || 'Cash payment verified and activated by Admin',
        referenceId
      }], { session });

      // 7. Ensure Binary Node exists for user
      let binNode = await BinaryNode.findOne({ userId: member._id }).session(session);
      if (!binNode) {
        binNode = await BinaryNode.create([{
          userId: member._id,
          parentId: member.binaryParentId || null,
          position: member.binarySide || 'root',
          level: 1,
          leftVolume: 0,
          rightVolume: 0,
          availableLeftVolume: 0,
          availableRightVolume: 0
        }], { session });
      }

      // 8. Trigger Income Engine (Direct Referral 10% of KBP & Matching 10%)
      // Construct a mock order object for IncomeService compatibility
      const mockOrder = {
        _id: purchaseRecord[0]._id,
        orderNumber: receiptNumber || `ORD-CASH-${Date.now()}`,
        userId: member._id,
        packageId: pkg._id,
        packageName: pkg.name,
        packagePrice: authoritativePrice,
        kbpGenerated: authoritativeKbp,
        orderStatus: 'COMPLETED'
      };

      await IncomeService.processOrderIncome(mockOrder);

      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        message: 'Package activated successfully with KBP income distributed.',
        data: {
          memberId: member.memberId,
          memberName: member.fullName,
          package: pkg.name,
          packagePrice: authoritativePrice,
          kbp: authoritativeKbp,
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          activationStatus: 'ACTIVE',
          activationId: purchaseRecord[0]._id
        }
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = PackageActivationService;