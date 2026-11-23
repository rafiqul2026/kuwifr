// server/src/services/sponsorChange.service.js
//
// Admin "Sponsor Change": moves a member AND their entire team (every
// member below them, at any depth) under a new sponsor.
//
// What moves:
//   - User.sponsorId of the member (their whole downline keeps its own
//     sponsors, so the team travels with them as one unit)
//   - the member's binary node: detached from the old binary parent and
//     re-placed in the new sponsor's tree on the chosen leg, using the same
//     findPlacement() spillover every normal registration uses. The node's
//     own children are untouched, so the whole binary team moves with it.
//   - Referral genealogy rows (10-level legacy table) for everyone moved
//   - directReferrals counters on the old and new sponsor
//
// What deliberately does NOT move (same rule as
// binary.service.js#correctMisplacedNodes): historical volume and income.
// leftVolume/rightVolume/totalKBP/matchingVolume and every IncomeTransaction
// already credited stay exactly as they are — that money was really paid
// through the old structure. From this point on, all NEW volume and income
// flows through the new structure.
const mongoose = require('mongoose');
const User = require('../models/User');
const BinaryNode = require('../models/BinaryNode');
const Referral = require('../models/Referral');
const BinaryService = require('./binary.service');

const BLOCKED = ['SUSPENDED', 'DEACTIVATED', 'BLOCKED'];
const MAX_REFERRAL_LEVEL = 10;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fail = (status, message) => {
  const err = new Error(message);
  err.statusCode = status;
  return err;
};

const findByMemberId = (memberId, session = null) => {
  const clean = String(memberId || '').trim();
  if (!clean) return null;
  const q = User.findOne({
    $or: [
      { memberId: { $regex: new RegExp(`^${escapeRegex(clean)}$`, 'i') } },
      { referralCode: { $regex: new RegExp(`^${escapeRegex(clean)}$`, 'i') } }
    ]
  });
  return session ? q.session(session) : q;
};

const resolveMember = async (idOrMemberId, session = null) => {
  if (mongoose.isValidObjectId(idOrMemberId)) {
    const q = User.findById(idOrMemberId);
    const byId = await (session ? q.session(session) : q);
    if (byId) return byId;
  }
  return findByMemberId(idOrMemberId, session);
};

/** Every member below `userId` in the sponsor tree, any depth, with relative depth (0 = direct). */
const getSponsorTeam = async (userId) => {
  const [result] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $graphLookup: {
        from: 'users',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'sponsorId',
        as: 'team',
        depthField: 'depth'
      }
    },
    { $project: { _id: 0, team: { _id: 1, sponsorId: 1, status: 1, createdAt: 1, depth: 1 } } }
  ]);
  return result?.team || [];
};

/** userIds of every node under `userId` in the binary tree (excluding itself). */
// Walks parentId links downward (a node is a real child only if its own
// parentId points at the parent), so stale child pointers are ignored.
const getBinarySubtreeIds = async (userId) => {
  const ids = new Set();
  let frontier = [userId];
  while (frontier.length) {
    const children = await BinaryNode.find({ parentId: { $in: frontier } }).select('userId').lean();
    frontier = [];
    for (const c of children) {
      const key = String(c.userId);
      if (ids.has(key) || key === String(userId)) continue;
      ids.add(key);
      frontier.push(c.userId);
    }
  }
  return ids;
};

/**
 * Where findPlacement() will put the member once they are detached: walks
 * the new sponsor's chosen extreme leg, treating the moving member's own
 * slot as already empty. Read-only.
 */
const previewPlacement = async (newSponsorId, side, movingUserId) => {
  let current = await BinaryNode.findOne({ userId: newSponsorId }).lean();
  if (!current) return { parentId: newSponsorId, position: side };
  const visited = new Set([String(current.userId)]);
  while (true) {
    const childId = side === 'left' ? current.leftChildId : current.rightChildId;
    if (!childId || String(childId) === String(movingUserId) || visited.has(String(childId))) break;
    visited.add(String(childId));
    const next = await BinaryNode.findOne({ userId: childId }).lean();
    if (!next || !next.parentId || String(next.parentId) !== String(current.userId)) break;
    current = next;
  }
  return { parentId: current.userId, position: side };
};

const describe = (u) => (u ? { _id: u._id, memberId: u.memberId, fullName: u.fullName, status: u.status } : null);

const validate = async ({ member, newSponsor, side }) => {
  if (!member) throw fail(404, 'Member not found.');
  if (!newSponsor) throw fail(404, 'New sponsor not found. Check the Member ID.');
  if ((member.role || 'MEMBER').toUpperCase() !== 'MEMBER') throw fail(403, 'Admin accounts cannot be moved.');
  if (member.isSystemRoot) throw fail(403, 'The company root account cannot be moved.');
  if (String(member._id) === String(newSponsor._id)) throw fail(400, 'A member cannot sponsor themselves.');
  if (member.sponsorId && String(member.sponsorId) === String(newSponsor._id)) {
    throw fail(400, `${newSponsor.fullName} (${newSponsor.memberId}) is already this member's sponsor.`);
  }
  if (BLOCKED.includes(newSponsor.status)) throw fail(400, `New sponsor is ${newSponsor.status}. Choose an active member.`);
  if (!['left', 'right'].includes(side)) throw fail(400, 'Choose the Left or Right leg for placement.');

  const team = await getSponsorTeam(member._id);
  if (team.some((t) => String(t._id) === String(newSponsor._id))) {
    throw fail(400, 'The new sponsor is inside this member\'s own team. Move them first, or choose a sponsor outside this team.');
  }
  const binaryIds = await getBinarySubtreeIds(member._id);
  if (binaryIds.has(String(newSponsor._id))) {
    throw fail(400, 'The new sponsor sits below this member in the binary tree. Choose a sponsor outside this team.');
  }
  return { team, binaryIds };
};

const preview = async ({ memberRef, newSponsorMemberId, side }) => {
  const normalizedSide = String(side || 'left').toLowerCase();
  const member = await resolveMember(memberRef);
  const newSponsor = await findByMemberId(newSponsorMemberId);
  const { team, binaryIds } = await validate({ member, newSponsor, side: normalizedSide });

  const [oldSponsor, node] = await Promise.all([
    member.sponsorId ? User.findById(member.sponsorId).select('memberId fullName status') : null,
    BinaryNode.findOne({ userId: member._id }).lean()
  ]);
  const oldBinaryParent = node?.parentId ? await User.findById(node.parentId).select('memberId fullName status') : null;
  const placement = await previewPlacement(newSponsor._id, normalizedSide, member._id);
  const newBinaryParent = await User.findById(placement.parentId).select('memberId fullName status');

  const activeInTeam = team.filter((t) => t.status === 'ACTIVE').length;
  return {
    member: describe(member),
    oldSponsor: describe(oldSponsor),
    newSponsor: describe(newSponsor),
    oldBinaryParent: oldBinaryParent ? { ...describe(oldBinaryParent), side: node?.position } : null,
    newBinaryParent: { ...describe(newBinaryParent), side: placement.position },
    team: {
      sponsorTeamSize: team.length,
      activeMembers: activeInTeam,
      binaryTeamSize: binaryIds.size,
      teamKBP: node ? Math.max(0, (node.leftVolume || 0) + (node.rightVolume || 0)) : 0,
      memberOwnKBP: node ? Math.max(0, (node.totalKBP || 0) - (node.leftVolume || 0) - (node.rightVolume || 0)) : 0
    }
  };
};

/** Rebuilds the legacy 10-level Referral rows for every moved member. */
const rebuildReferralRows = async ({ member, team, newSponsorId, session }) => {
  const moved = [{ _id: member._id, sponsorId: newSponsorId, status: member.status, createdAt: member.createdAt, depth: -1 }, ...team];
  const movedIds = moved.map((m) => m._id);
  const movedSet = new Set(movedIds.map(String));
  const sponsorOf = new Map(moved.map((m) => [String(m._id), m.sponsorId ? String(m.sponsorId) : null]));

  // Rows linking a moved member to an ancestor OUTSIDE the team are now wrong.
  await Referral.deleteMany({ userId: { $in: movedIds }, sponsorId: { $nin: movedIds } }, { session });

  // External ancestor chain, starting at the new sponsor.
  const external = [];
  let cursor = newSponsorId;
  while (cursor && external.length < MAX_REFERRAL_LEVEL) {
    const u = await User.findById(cursor).select('_id sponsorId').session(session).lean();
    if (!u) break;
    external.push(String(u._id));
    cursor = u.sponsorId;
  }

  const ops = [];
  for (const m of moved) {
    // Internal chain: this member's sponsor up to and including the moved member.
    const internal = [];
    let c = sponsorOf.get(String(m._id));
    while (c && movedSet.has(c) && internal.length < MAX_REFERRAL_LEVEL) {
      internal.push(c);
      c = sponsorOf.get(c);
    }
    const chain = [...internal, ...external].slice(0, MAX_REFERRAL_LEVEL);
    for (let i = internal.length; i < chain.length; i += 1) {
      ops.push({
        updateOne: {
          filter: { sponsorId: chain[i], userId: m._id },
          update: {
            $set: {
              level: i + 1,
              parentId: i === 0 ? sponsorOf.get(String(m._id)) : chain[i - 1],
              path: chain.slice(0, i + 1).join('-'),
              isActive: m.status === 'ACTIVE'
            },
            $setOnInsert: { joinedAt: m.createdAt || new Date() }
          },
          upsert: true
        }
      });
    }
  }
  if (ops.length) await Referral.bulkWrite(ops, { session });
  return ops.length;
};

/** Re-numbers BinaryNode.level for a moved subtree. */
const relevelSubtree = async (rootUserId, rootLevel, session) => {
  const ops = [];
  let frontier = [{ userId: rootUserId, level: rootLevel }];
  const seen = new Set([String(rootUserId)]);
  while (frontier.length) {
    const byId = new Map(frontier.map((f) => [String(f.userId), f.level]));
    const nodes = await BinaryNode.find({ userId: { $in: frontier.map((f) => f.userId) } })
      .select('userId leftChildId rightChildId').session(session).lean();
    const next = [];
    for (const n of nodes) {
      const lvl = byId.get(String(n.userId));
      for (const child of [n.leftChildId, n.rightChildId]) {
        if (!child || seen.has(String(child))) continue;
        seen.add(String(child));
        next.push({ userId: child, level: lvl + 1 });
        ops.push({ updateOne: { filter: { userId: child, parentId: n.userId }, update: { $set: { level: lvl + 1 } } } });
      }
    }
    frontier = next;
  }
  if (ops.length) await BinaryNode.bulkWrite(ops, { session });
};

const execute = async ({ memberRef, newSponsorMemberId, side, reason }) => {
  const normalizedSide = String(side || 'left').toLowerCase();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const member = await resolveMember(memberRef, session);
    const newSponsor = await findByMemberId(newSponsorMemberId, session);
    const { team } = await validate({ member, newSponsor, side: normalizedSide });

    const oldSponsorId = member.sponsorId || null;
    const oldSponsor = oldSponsorId ? await User.findById(oldSponsorId).select('memberId fullName').session(session) : null;

    // ---- Binary tree ----
    const node = await BinaryNode.findOne({ userId: member._id }).session(session);
    let oldBinaryParentId = null;
    let placement = null;
    if (node) {
      oldBinaryParentId = node.parentId || null;
      if (oldBinaryParentId) {
        await BinaryNode.updateOne({ userId: oldBinaryParentId, leftChildId: member._id }, { $set: { leftChildId: null } }, { session });
        await BinaryNode.updateOne({ userId: oldBinaryParentId, rightChildId: member._id }, { $set: { rightChildId: null } }, { session });
      }

      placement = await BinaryService.findPlacement(newSponsor._id, normalizedSide, session);
      const parentNode = await BinaryNode.findOne({ userId: placement.parentId }).session(session);
      if (!parentNode) throw fail(500, 'Could not find the new binary parent. Nothing was changed.');
      parentNode[placement.position === 'left' ? 'leftChildId' : 'rightChildId'] = member._id;
      await parentNode.save({ session });

      node.parentId = parentNode.userId;
      node.position = placement.position;
      node.level = (parentNode.level || 1) + 1;
      await node.save({ session });
      await relevelSubtree(member._id, node.level, session);
    }

    // ---- Sponsor + counters ----
    // Targeted update (not member.save()) so unrelated validation hooks on
    // older records can't block the move — only these fields change.
    const memberUpdate = { sponsorId: newSponsor._id };
    if (placement) {
      memberUpdate.binarySide = placement.position;
      memberUpdate.binaryParentId = placement.parentId;
    }
    await User.updateOne({ _id: member._id }, { $set: memberUpdate }, { session });

    if (oldSponsorId) {
      await User.updateOne({ _id: oldSponsorId, directReferrals: { $gt: 0 } }, { $inc: { directReferrals: -1 } }, { session });
    }
    await User.updateOne({ _id: newSponsor._id }, { $inc: { directReferrals: 1 } }, { session });

    const referralRowsWritten = await rebuildReferralRows({ member, team, newSponsorId: newSponsor._id, session });

    await session.commitTransaction();

    const newBinaryParent = placement ? await User.findById(placement.parentId).select('memberId fullName') : null;
    const oldBinaryParent = oldBinaryParentId ? await User.findById(oldBinaryParentId).select('memberId fullName') : null;

    return {
      member: describe(member),
      oldSponsor: describe(oldSponsor),
      newSponsor: describe(newSponsor),
      oldBinaryParent: oldBinaryParent ? describe(oldBinaryParent) : null,
      newBinaryParent: newBinaryParent ? { ...describe(newBinaryParent), side: placement.position } : null,
      movedTeamSize: team.length,
      referralRowsWritten,
      reason: reason || ''
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { preview, execute, findByMemberId, resolveMember };
