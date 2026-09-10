// server/src/controllers/rule.controller.js
const Rule = require('../models/Rule');

// GET /api/admin/rules
const getRules = async (req, res, next) => {
  try {
    const rules = await Rule.find().sort({ key: 1 }).lean();
    res.json({ success: true, data: { rules } });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/rules
const createRule = async (req, res, next) => {
  try {
    const { key, value, type, description, status } = req.body;
    if (!key || value === undefined || value === null || value === '') {
      return res.status(400).json({ success: false, message: 'Key and value are required.' });
    }

    const existing = await Rule.findOne({ key: key.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: `A rule with key "${key}" already exists.` });
    }

    const coercedValue = type === 'BOOLEAN'
      ? (value === true || value === 'true')
      : (type === 'NUMBER' || type === 'PERCENTAGE') ? Number(value) : value;

    const rule = await Rule.create({
      key: key.trim(),
      value: coercedValue,
      type: type || 'STRING',
      description: description || '',
      status: status || 'ACTIVE'
    });

    res.status(201).json({ success: true, message: 'Rule created successfully', data: { rule } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/rules/:id
const updateRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { value, type, description, status } = req.body;

    const rule = await Rule.findById(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }

    const effectiveType = type || rule.type;
    if (value !== undefined) {
      rule.value = effectiveType === 'BOOLEAN'
        ? (value === true || value === 'true')
        : (effectiveType === 'NUMBER' || effectiveType === 'PERCENTAGE') ? Number(value) : value;
    }
    if (type !== undefined) rule.type = type;
    if (description !== undefined) rule.description = description;
    if (status !== undefined) rule.status = status;

    await rule.save();

    res.json({ success: true, message: 'Rule updated successfully', data: { rule } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/rules/:id
const deleteRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rule = await Rule.findByIdAndDelete(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRules,
  createRule,
  updateRule,
  deleteRule
};
