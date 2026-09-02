const mongoose = require('mongoose');

/**
 * Binary Node Schema - Represents each member's position in the binary tree
 * The binary tree determines matching income
 */
const BinaryNodeSchema = new mongoose.Schema({
  // User at this node
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Parent node (sponsor in binary tree)
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },

  // Position relative to parent: 'left' or 'right'
  position: {
    type: String,
    enum: ['left', 'right', 'root'],
    default: 'root'
  },

  // Child nodes
  leftChildId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rightChildId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // ============ VOLUME TRACKING ============
  
  // Total KBP in left subtree
  leftVolume: {
    type: Number,
    default: 0
  },
  
  // Total KBP in right subtree
  rightVolume: {
    type: Number,
    default: 0
  },
  
  // Total KBP matched (pairs)
  matchingVolume: {
    type: Number,
    default: 0
  },
  
  // Unmatched volume available for future matching
  availableLeftVolume: {
    type: Number,
    default: 0
  },
  availableRightVolume: {
    type: Number,
    default: 0
  },

  // Total pairs formed at this node
  pairCount: {
    type: Number,
    default: 0
  },

  // Total KBP in entire subtree
  totalKBP: {
    type: Number,
    default: 0
  },

  // Level in the tree (root = 1)
  level: {
    type: Number,
    default: 1
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster tree operations
BinaryNodeSchema.index({ parentId: 1, position: 1 });
BinaryNodeSchema.index({ leftChildId: 1 });
BinaryNodeSchema.index({ rightChildId: 1 });
BinaryNodeSchema.index({ level: 1 });

const BinaryNode = mongoose.model('BinaryNode', BinaryNodeSchema);
module.exports = BinaryNode;