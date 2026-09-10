// server/src/models/Rule.js
// Generic admin-editable key/value "Business Rules" store — a free-form
// escape hatch for settings that don't fit the structured Compensation
// Settings schema (see Setting.js / settings.service.js), so the admin can
// still change miscellaneous operational values without a code deploy.
const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    type: {
      type: String,
      enum: ['NUMBER', 'STRING', 'BOOLEAN', 'PERCENTAGE'],
      default: 'STRING'
    },
    description: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rule', ruleSchema);
