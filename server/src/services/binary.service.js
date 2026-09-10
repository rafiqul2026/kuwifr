// server/src/services/binary.service.js
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');
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

    const SettingsService = require('./settings.service');
    const matchingCfg = await SettingsService.getMatching();

    const leftAvail = node.availableLeftVolume || 0;
    const rightAvail = node.availableRightVolume || 0;

    const directLeftCount = await User.countDocuments({ sponsorId: user._id, binarySide: 'left', status: 'ACTIVE' });
    const directRightCount = await User.countDocuments({ sponsorId: user._id, binarySide: 'right', status: 'ACTIVE' });
    const totalDirectCount = directLeftCount + directRightCount;

    const UNIT = matchingCfg.unitValue;
    const SMALL = matchingCfg.firstPairSmallUnits;
    const LARGE = matchingCfg.firstPairLargeUnits;
    const pairCount = node.pairCount || 0;

    let matchingUnits = 0; // counted in UNIT-sized pairs (1 pair = 1 matched UNIT of volume on the smaller leg)
    let leftDeduct = 0;
    let rightDeduct = 0;

    // 1. FIRST PAIR MATCHING (2:1 or 1:2 by default, both configurable)
    if (pairCount === 0) {
      const hasFirstPairDirects = directLeftCount >= 1 && directRightCount >= 1 && totalDirectCount >= matchingCfg.firstPairMinDirects;
      const canMatchLeftHeavy = leftAvail >= LARGE * UNIT && rightAvail >= SMALL * UNIT;
      const canMatchRightHeavy = leftAvail >= SMALL * UNIT && rightAvail >= LARGE * UNIT;

      if (hasFirstPairDirects && (canMatchLeftHeavy || canMatchRightHeavy)) {
        if (canMatchLeftHeavy) {
          leftDeduct = LARGE * UNIT;
          rightDeduct = SMALL * UNIT;
        } else {
          leftDeduct = SMALL * UNIT;
          rightDeduct = LARGE * UNIT;
        }

        matchingUnits = SMALL; // the smaller leg's units are what "matched" — the income unit
        node.pairCount = 1;
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

      // Matching Income = matchingCfg.rate (business plan default 10%) of the
      // matched KBP volume — NOT the full matched volume itself. Paying 100%
      // of matched volume here previously blew straight through the daily cap
      // on a single pair and paid ~10x what the plan specifies.
      const matchedVolume = matchingUnits * UNIT;
      const grossAmount = matchedVolume * matchingCfg.rate;

      // Route through the shared income engine so this respects the SAME
      // daily/weekly/monthly package caps as referral/leadership income (not
      // just a bare dailyCap check against this one payout), and so it is
      // recorded as an IncomeTransaction (income history/reports/admin
      // reports previously never saw binary matching income at all, since it
      // was credited by mutating wallet fields directly).
      const IncomeService = require('./income.service');
      const cappedResult = await IncomeService.applyCaps(user._id, grossAmount);

      if (cappedResult.allowedAmount > 0) {
        const creditResult = await IncomeService.creditIncome(
          user._id,
          cappedResult.allowedAmount,
          'MATCHING_INCOME',
          node._id,
          'BinaryNode',
          matchedVolume,
          matchingCfg.rate,
          { pairCount: matchingUnits, unitValue: UNIT }
        );

        if (creditResult && creditResult.transaction) {
          const IncomeTransaction = require('../models/IncomeTransaction');
          await IncomeTransaction.findByIdAndUpdate(creditResult.transaction._id, {
            capBreakdown: cappedResult.capBreakdown,
            grossAmount,
            capAdjustment: grossAmount - cappedResult.allowedAmount
          });
        }

        // Leadership / Cheque Match Bonus: paid to qualified upline leaders as
        // a % of the matching income this member (a "leader") actually earned.
        if (creditResult && creditResult.success) {
          await IncomeService.processLeadershipBonusForMatch(user._id, cappedResult.allowedAmount, node._id);
        }
      } else if (grossAmount > 0) {
        // A REAL pair just matched (node.matchingVolume/pairCount above were
        // already saved) but the member's daily/weekly/monthly package cap
        // left zero room to actually pay it — previously this branch simply
        // did nothing, so a member's "Total KBP Match" could grow for real
        // while their income stayed ₹0 forever with NO record anywhere of
        // why. Record it as a FAILED (₹0-credited) IncomeTransaction with
        // the cap breakdown attached, so this is now auditable from the
        // Admin Income Report instead of invisible.
        try {
          const IncomeTransaction = require('../models/IncomeTransaction');
          const WalletService = require('./wallet.service');
          const fallbackWallet = await WalletService.getOrCreateWallet(user._id);
          await IncomeTransaction.create({
            userId: user._id,
            transactionId: `MATCH-CAPPED-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase(),
            type: 'MATCHING_INCOME',
            sourceId: node._id,
            sourceModel: 'BinaryNode',
            kbp: matchedVolume,
            rate: matchingCfg.rate,
            grossAmount,
            capAdjustment: grossAmount,
            creditedAmount: 0,
            walletType: 'INCOME',
            walletId: fallbackWallet._id,
            status: 'FAILED',
            processedAt: new Date(),
            capBreakdown: cappedResult.capBreakdown,
            metadata: { pairCount: matchingUnits, unitValue: UNIT, failureReason: 'CAPPED_TO_ZERO — daily/weekly/monthly package cap already exhausted' }
          });
        } catch (logError) {
          console.error('   Failed to record capped-to-zero matching income:', logError.message);
        }
      }

      // Rank & Reward starts from 1st Pair Matching only — re-evaluate through
      // the single official rank engine (dynamic requirements, persisted
      // RankAchievement, rank-salary eligibility) rather than setting
      // currentRankId directly here.
      const RankService = require('./rank.service');
      await RankService.checkAndAwardRanks(user._id).catch((err) => {
        console.error('   Rank check after matching failed:', err.message);
      });
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
      .populate('activePackageId', 'name type kbp')
      .populate('sponsorId', 'fullName memberId referralCode')
      .lean();

    const personalKbp = user && (user.status || '').toUpperCase() === 'ACTIVE'
      ? Number(user.activePackageId?.kbp) || 0
      : 0;

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
      sponsorName: user?.sponsorId?.fullName || '',
      referralLevel,
      packageName: user?.activePackageId?.name || 'Starter Package',
      personalKbp,
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
      // True only when a real child exists in the DB but this response's
      // depth limit stopped short of fetching it — lets callers distinguish
      // "genuinely open position" from "has downline, just not in this
      // response" instead of guessing from an empty children array.
      hasMoreLeft: false,
      hasMoreRight: false,
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
    } else {
      // Depth exhausted — a real child may still exist below; flag it so
      // the UI shows "view more" instead of an incorrect vacant slot.
      if (rootNode.leftChildId) tree.hasMoreLeft = true;
      if (rootNode.rightChildId) tree.hasMoreRight = true;
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

  /**
   * BFS an entire subtree, unlimited depth, following the SAME pointers
   * getTree() uses to actually render the visible Growth Generation tree —
   * a parent's own leftChildId/rightChildId — rather than each child's own
   * parentId+position fields.
   *
   * WHY THIS MATTERS: BinaryNode stores the tree twice — top-down on the
   * parent (leftChildId/rightChildId) and bottom-up on the child
   * (parentId/position). placeMember() writes both together, but they are
   * two separate .save() calls (not one atomic write), and a member's
   * position can also be repaired/re-derived independently of a full
   * placeMember() re-run. In practice the two representations were found to
   * drift out of sync: getTree()'s top-down walk showed a real, deep,
   * correctly-populated tree, while a bottom-up query for
   * "BinaryNode.findOne({ parentId, position })" — the OLD implementation
   * of getBranchMembers below — returned 0 members for the exact same
   * subtree, because the child-side parentId/position fields didn't
   * reliably agree with the parent-side leftChildId/rightChildId that the
   * tree itself trusts. Walking top-down here, the same way getTree does,
   * makes "Total Downline Left/Right" (My Team Overview) and the Growth
   * Generation Map's own Member Left/Right totals structurally incapable of
   * disagreeing with what the tree visibly shows, because they're now
   * reading the exact same pointers.
   */
  async _walkSubtreeIds(startUserId) {
    if (!startUserId) return [];
    const visited = new Set([String(startUserId)]);
    const collected = [startUserId];
    let frontier = [startUserId];

    while (frontier.length > 0) {
      const nodes = await BinaryNode.find({ userId: { $in: frontier } })
        .select('userId leftChildId rightChildId')
        .lean();

      const nextFrontier = [];
      for (const node of nodes) {
        for (const childId of [node.leftChildId, node.rightChildId]) {
          if (!childId) continue;
          const childKey = String(childId);
          if (visited.has(childKey)) continue;
          visited.add(childKey);
          collected.push(childId);
          nextFrontier.push(childId);
        }
      }
      frontier = nextFrontier;
    }

    return collected;
  }

  /** Counts-only variant of getBranchMembers — skips the User lookup entirely. */
  async getBranchCounts(userId) {
    const { leftIds, rightIds } = await this.getBranchUserIds(userId);
    return { leftCount: leftIds.length, rightCount: rightIds.length };
  }

  /**
   * Id-only variant of getBranchMembers — just the left/right subtree user
   * ids (any depth), computed the same top-down way as getTree/getBranchCounts.
   * Callers that need to attribute OTHER records (e.g. Order.kbpGenerated,
   * for "today's business") to a member's left vs. right leg use this
   * instead of User.binarySide, which only encodes a member's position under
   * their OWN sponsor/parent — not their side relative to this root — and so
   * cannot be used to classify arbitrary downline members as left/right of
   * `userId`.
   */
  async getBranchUserIds(userId) {
    const rootNode = await BinaryNode.findOne({ userId }).select('leftChildId rightChildId').lean();
    if (!rootNode) return { leftIds: [], rightIds: [] };

    const [leftIds, rightIds] = await Promise.all([
      this._walkSubtreeIds(rootNode.leftChildId),
      this._walkSubtreeIds(rootNode.rightChildId)
    ]);

    return { leftIds, rightIds };
  }

  /**
   * Fetch all downline members under a specific branch (LEFT or RIGHT) up to unlimited depth.
   */
  async getBranchMembers(userId, position) {
    const normalizedPosition = String(position || '').toLowerCase();
    const rootNode = await BinaryNode.findOne({ userId }).select('leftChildId rightChildId').lean();
    const startId = normalizedPosition === 'right' ? rootNode?.rightChildId : rootNode?.leftChildId;

    if (!rootNode || !startId) {
      return { count: 0, members: [] };
    }

    const subtreeUserIds = await this._walkSubtreeIds(startId);

    const membersList = await User.find({ _id: { $in: subtreeUserIds } })
      .select('memberId fullName email phoneNumber status activePackageId createdAt binarySide')
      .populate('activePackageId', 'name')
      .lean();

    return {
      count: membersList.length,
      members: membersList
    };
  }

  /**
   * Get complete binary team overview with Left and Right downline breakdown for any member up to unlimited depth.
   */
  async getTeamOverview(userId) {
    const [leftBranch, rightBranch] = await Promise.all([
      this.getBranchMembers(userId, 'LEFT'),
      this.getBranchMembers(userId, 'RIGHT')
    ]);

    const userDoc = await User.findById(userId).select('fullName memberId status').lean();

    return {
      user: userDoc,
      leftCount: leftBranch.count,
      rightCount: rightBranch.count,
      leftMembers: leftBranch.members,
      rightMembers: rightBranch.members
    };
  }

  /**
   * Non-destructive repair pass: for every user in the system (processed in
   * registration order so sponsors are always handled before the people
   * they referred), checks whether they are correctly linked into the
   * binary tree — a BinaryNode exists AND their sponsor's node actually
   * points back at them via leftChildId/rightChildId — and if not, places
   * them via placeMember(). It NEVER deletes anything and never touches a
   * link that is already correct, so it's safe to run repeatedly.
   *
   * This exists because User/Referral (sponsor) records and BinaryNode
   * (tree position) records are maintained separately: a member can end up
   * with a perfectly correct sponsor relationship (so "My Team" shows them
   * fine) while their actual tree placement never happened or was lost —
   * for example this codebase used to ship a public, unauthenticated
   * `/api/users/reindex-binary` endpoint that wiped the entire BinaryNode
   * collection (removed — see user.routes.js). Run this afterward to
   * restore every member's placement from the sponsor data that's still
   * intact.
   *
   * Returns a summary of what was fixed so the caller can report it.
   */
  async repairAllPlacements() {
    const users = await User.find({}).select('_id sponsorId binarySide memberId fullName').sort({ createdAt: 1 }).lean();

    const summary = {
      totalUsers: users.length,
      rootsEnsured: 0,
      placementsFixed: [],
      alreadyCorrect: 0,
      errors: []
    };

    for (const user of users) {
      try {
        if (!user.sponsorId) {
          // Root / no-sponsor account — ensure it at least has a BinaryNode.
          const existing = await BinaryNode.findOne({ userId: user._id });
          if (!existing) {
            await BinaryNode.create({
              userId: user._id,
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
            summary.rootsEnsured += 1;
          }
          continue;
        }

        const ownNode = await BinaryNode.findOne({ userId: user._id });
        let correctlyLinked = false;

        if (ownNode && ownNode.parentId) {
          const parentNode = await BinaryNode.findOne({ userId: ownNode.parentId });
          if (parentNode) {
            correctlyLinked =
              String(parentNode.leftChildId) === String(user._id) ||
              String(parentNode.rightChildId) === String(user._id);
          }
        }

        if (correctlyLinked) {
          summary.alreadyCorrect += 1;
          continue;
        }

        await this.placeMember(user._id, user.sponsorId, user.binarySide || 'left');
        summary.placementsFixed.push({ userId: user._id, memberId: user.memberId, fullName: user.fullName });
      } catch (err) {
        summary.errors.push({ userId: user._id, memberId: user.memberId, message: err.message });
      }
    }

    return summary;
  }
}

module.exports = new BinaryService();