// server/src/services/binary.service.js
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Rank = require('../models/Rank');
const Referral = require('../models/Referral');

class BinaryService {
  /**
   * Generates referral links for Left and Right sides
   */
  async getReferralLinks(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const identifier = user.memberId || user.referralCode;

    return {
      left: {
        url: `${baseUrl}/register?ref=${identifier}&side=left`,
        side: 'left',
        label: 'Left Side Referral'
      },
      right: {
        url: `${baseUrl}/register?ref=${identifier}&side=right`,
        side: 'right',
        label: 'Right Side Referral'
      },
      referralCode: identifier
    };
  }

  /**
   * Extreme Leg Spillover:
   * Traverses strictly down the specified leg (Left-most or Right-most) to find
   * the bottom leaf node without circular references.
   */
  async findPlacement(sponsorId, preferredSide = 'left') {
    const side = (preferredSide || 'left').toLowerCase() === 'right' ? 'right' : 'left';

    let sponsorNode = await BinaryNode.findOne({ userId: sponsorId });
    if (!sponsorNode) {
      sponsorNode = await BinaryNode.create({
        userId: sponsorId,
        parentId: null,
        position: 'root',
        level: 1,
        leftChildId: null,
        rightChildId: null,
        leftVolume: 0,
        rightVolume: 0,
        availableLeftVolume: 0,
        availableRightVolume: 0,
        matchingVolume: 0,
        pairCount: 0,
        totalKBP: 0
      });
    }

    let currentNode = sponsorNode;
    let targetParentId = sponsorNode.userId;
    let currentBinaryDepth = sponsorNode.level || 1;
    const visited = new Set([String(sponsorNode.userId)]);

    while (true) {
      const childUserId = side === 'left' ? currentNode.leftChildId : currentNode.rightChildId;

      if (!childUserId || String(childUserId) === String(currentNode.userId)) {
        targetParentId = currentNode.userId;
        break;
      }

      if (visited.has(String(childUserId))) {
        targetParentId = currentNode.userId;
        break;
      }

      visited.add(String(childUserId));

      const nextNode = await BinaryNode.findOne({ userId: childUserId });
      if (!nextNode) {
        targetParentId = currentNode.userId;
        break;
      }

      currentNode = nextNode;
      currentBinaryDepth = (currentNode.level || currentBinaryDepth) + 1;
    }

    return { parentId: targetParentId, position: side, level: currentBinaryDepth + 1 };
  }

  /**
   * Places a new member into the binary tree
   */
  async placeMember(userId, sponsorId, preferredSide = 'left') {
    if (String(userId) === String(sponsorId)) return null;

    const side = (preferredSide || 'left').toLowerCase() === 'right' ? 'right' : 'left';
    const placement = await this.findPlacement(sponsorId, side);

    const parentNode = await BinaryNode.findOne({ userId: placement.parentId });
    const binaryLevel = parentNode ? (parentNode.level || 1) + 1 : 2;

    let newNode = await BinaryNode.findOne({ userId });
    if (!newNode) {
      newNode = new BinaryNode({
        userId,
        parentId: placement.parentId,
        position: placement.position,
        level: binaryLevel,
        leftChildId: null,
        rightChildId: null,
        leftVolume: 0,
        rightVolume: 0,
        availableLeftVolume: 0,
        availableRightVolume: 0,
        matchingVolume: 0,
        pairCount: 0,
        totalKBP: 0
      });
    } else {
      newNode.parentId = placement.parentId;
      newNode.position = placement.position;
      newNode.level = binaryLevel;
    }
    await newNode.save();

    if (parentNode) {
      if (placement.position === 'left') {
        parentNode.leftChildId = userId;
      } else {
        parentNode.rightChildId = userId;
      }
      await parentNode.save();
    }

    await User.findByIdAndUpdate(userId, { binarySide: placement.position });
    return newNode;
  }

  /**
   * Propagates KBP volume up the binary upline
   */
  async updateVolumes(userId, kbp) {
    if (!kbp || kbp <= 0) return true;

    let currentNode = await BinaryNode.findOne({ userId });
    if (!currentNode) return false;

    currentNode.totalKBP = (currentNode.totalKBP || 0) + kbp;
    await currentNode.save();

    let childUserId = currentNode.userId;
    let parentId = currentNode.parentId;
    const visited = new Set([String(childUserId)]);

    while (parentId) {
      if (visited.has(String(parentId))) break;
      visited.add(String(parentId));

      const parentNode = await BinaryNode.findOne({ userId: parentId });
      if (!parentNode) break;

      const isLeft = String(parentNode.leftChildId) === String(childUserId);

      if (isLeft) {
        parentNode.leftVolume = (parentNode.leftVolume || 0) + kbp;
        parentNode.availableLeftVolume = (parentNode.availableLeftVolume || 0) + kbp;
      } else {
        parentNode.rightVolume = (parentNode.rightVolume || 0) + kbp;
        parentNode.availableRightVolume = (parentNode.availableRightVolume || 0) + kbp;
      }

      parentNode.totalKBP = (parentNode.totalKBP || 0) + kbp;
      await parentNode.save();

      await this.calculateMatching(parentNode);

      childUserId = parentNode.userId;
      parentId = parentNode.parentId;
    }

    return true;
  }

  /**
   * Binary Matching Calculation:
   * 1. First Pair: 2:1 or 1:2 (Requires 2 Directs: 1 Left + 1 Right)
   * 2. Kuwi Star Rank: Requires 3 Direct Sponsors across both sides
   * 3. Subsequent Pairs: 1:1 Matching to Unlimited Depth
   */
  async calculateMatching(node) {
    const user = await User.findById(node.userId).populate('activePackageId');
    if (!user) return node;

    const leftAvail = node.availableLeftVolume || 0;
    const rightAvail = node.availableRightVolume || 0;

    const directLeftCount = await User.countDocuments({ sponsorId: user._id, binarySide: 'left', status: 'ACTIVE' });
    const directRightCount = await User.countDocuments({ sponsorId: user._id, binarySide: 'right', status: 'ACTIVE' });
    const totalDirectCount = directLeftCount + directRightCount;

    const UNIT = 1000;
    const pairCount = node.pairCount || 0;

    let matchingUnits = 0;
    let leftDeduct = 0;
    let rightDeduct = 0;

    // 1. FIRST PAIR MATCHING (2:1 or 1:2)
    if (pairCount === 0) {
      const hasFirstPairDirects = directLeftCount >= 1 && directRightCount >= 1 && totalDirectCount >= 2;
      const canMatch2to1 = leftAvail >= 2 * UNIT && rightAvail >= 1 * UNIT;
      const canMatch1to2 = leftAvail >= 1 * UNIT && rightAvail >= 2 * UNIT;

      if (hasFirstPairDirects && (canMatch2to1 || canMatch1to2)) {
        if (canMatch2to1) {
          leftDeduct = 2 * UNIT;
          rightDeduct = 1 * UNIT;
        } else {
          leftDeduct = 1 * UNIT;
          rightDeduct = 2 * UNIT;
        }

        matchingUnits = 1;
        node.pairCount = 1;

        if (totalDirectCount >= 3) {
          const starRank = await Rank.findOne({ code: 'KUWI_STAR' });
          if (starRank && !user.currentRankId) {
            user.currentRankId = starRank._id;
            await user.save();
          }
        }
      }
    } 
    // 2. NEXT PAIRS (1:1 TO UNLIMITED DEPTH)
    else {
      const possiblePairs = Math.min(Math.floor(leftAvail / UNIT), Math.floor(rightAvail / UNIT));

      if (possiblePairs > 0) {
        leftDeduct = possiblePairs * UNIT;
        rightDeduct = possiblePairs * UNIT;
        matchingUnits = possiblePairs;
        node.pairCount += possiblePairs;
      }
    }

    if (matchingUnits > 0) {
      node.availableLeftVolume = Math.max(0, node.availableLeftVolume - leftDeduct);
      node.availableRightVolume = Math.max(0, node.availableRightVolume - rightDeduct);
      node.matchingVolume = (node.matchingVolume || 0) + matchingUnits * UNIT;
      await node.save();

      const earnedAmount = matchingUnits * UNIT;
      const dailyCap = user.activePackageId?.dailyCap || 1500;
      const actualPayout = Math.min(earnedAmount, dailyCap);

      const wallet = await Wallet.findOne({ userId: user._id });
      if (wallet) {
        wallet.binaryIncome = (wallet.binaryIncome || 0) + actualPayout;
        wallet.incomeBalance = (wallet.incomeBalance || 0) + actualPayout;
        wallet.totalIncome = (wallet.totalIncome || 0) + actualPayout;
        await wallet.save();
      }
    }

    return node;
  }

  /**
   * Clean Recursive Tree Retrieval with Unilevel Generation Tracking
   */
  async getTree(userId, depth = 5, visited = new Set(), rootUserId = null) {
    if (!userId) return null;

    const actualRootId = rootUserId || userId;
    const userIdStr = String(userId);
    if (visited.has(userIdStr)) return null;
    visited.add(userIdStr);

    const rootNode = await BinaryNode.findOne({ userId });
    if (!rootNode) return null;

    const user = await User.findById(userId)
      .select('fullName email memberId referralCode sponsorId binarySide status activePackageId')
      .populate('activePackageId', 'name type')
      .populate('sponsorId', 'fullName memberId referralCode')
      .lean();

    // Determine unilevel generation level relative to root viewer
    let referralLevel = 1;
    if (String(userId) === String(actualRootId)) {
      referralLevel = 0;
    } else {
      const refRecord = await Referral.findOne({ sponsorId: actualRootId, userId: user?._id });
      if (refRecord) {
        referralLevel = refRecord.level;
      } else if (user?.sponsorId && String(user.sponsorId._id) === String(actualRootId)) {
        referralLevel = 1;
      }
    }

    const sponsorCode = user?.sponsorId?.memberId || user?.sponsorId?.referralCode || 'Direct Root';

    const tree = {
      userId: rootNode.userId,
      memberId: user?.memberId || 'KFR------',
      fullName: user ? user.fullName : 'Member',
      email: user ? user.email : 'N/A',
      sponsorId: sponsorCode,
      referralLevel,
      packageName: user?.activePackageId?.name || 'Starter Package',
      status: user?.status || 'ACTIVE',
      side: user ? user.binarySide || 'root' : 'root',
      binaryLevel: rootNode.level || 1,
      leftVolume: rootNode.leftVolume || 0,
      rightVolume: rootNode.rightVolume || 0,
      availableLeftVolume: rootNode.availableLeftVolume || 0,
      availableRightVolume: rootNode.availableRightVolume || 0,
      matchingVolume: rootNode.matchingVolume || 0,
      pairCount: rootNode.pairCount || 0,
      totalKBP: rootNode.totalKBP || 0,
      children: []
    };

    if (depth > 1) {
      if (rootNode.leftChildId && String(rootNode.leftChildId) !== userIdStr && !visited.has(String(rootNode.leftChildId))) {
        const leftSubTree = await this.getTree(rootNode.leftChildId, depth - 1, new Set(visited), actualRootId);
        if (leftSubTree) {
          tree.children.push({ position: 'left', ...leftSubTree });
        }
      }

      if (rootNode.rightChildId && String(rootNode.rightChildId) !== userIdStr && !visited.has(String(rootNode.rightChildId))) {
        const rightSubTree = await this.getTree(rootNode.rightChildId, depth - 1, new Set(visited), actualRootId);
        if (rightSubTree) {
          tree.children.push({ position: 'right', ...rightSubTree });
        }
      }
    }

    return tree;
  }

  async getTeamStats(userId) {
    const directReferrals = await User.find({ sponsorId: userId }).select('fullName email status createdAt binarySide memberId');
    const binaryNode = await BinaryNode.findOne({ userId });

    return {
      leftVolume: binaryNode ? binaryNode.leftVolume : 0,
      rightVolume: binaryNode ? binaryNode.rightVolume : 0,
      availableLeftVolume: binaryNode ? binaryNode.availableLeftVolume : 0,
      availableRightVolume: binaryNode ? binaryNode.availableRightVolume : 0,
      matchingVolume: binaryNode ? binaryNode.matchingVolume : 0,
      pairCount: binaryNode ? binaryNode.pairCount : 0,
      totalKBP: binaryNode ? binaryNode.totalKBP : 0,
      directCount: directReferrals.length
    };
  }
}

module.exports = new BinaryService();