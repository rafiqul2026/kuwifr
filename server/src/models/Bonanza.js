// server/src/models/Bonanza.js
const mongoose = require('mongoose');

const BonanzaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  periodType: {
    type: String,
    enum: ['Monthly', 'Quarterly'],
    default: 'Monthly'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  targetIncome: {
    type: Number,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  coverageDetails: {
    type: String,
    default: 'KUWIFR SERVICES PVT LTD will provide all expenses from nearby railway station to the targeted spot.'
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'UPCOMING', 'EXPIRED'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Bonanza', BonanzaSchema);