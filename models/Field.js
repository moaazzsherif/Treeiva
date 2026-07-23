const mongoose = require('mongoose');

const FieldSchema = new mongoose.Schema({
  field_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  crop: { type: String, required: true, default: 'Wheat' },
  crop_ar: { type: String, default: 'قمح' },
  soil_type: { type: String, default: 'Clay Loam' },
  area_ha: { type: Number, default: 5.0 },
  area_feddan: { type: Number, default: 11.9 },
  moisture: { type: Number, default: 35.0 },
  ndvi: { type: Number, default: 0.65 },
  organic_matter: { type: Number, default: 2.0 },
  clay_ratio: { type: Number, default: 35.0 },
  sand_ratio: { type: Number, default: 25.0 },
  coordinates: { type: Array, default: [] },
  history: [{
    date: { type: String },
    event: { type: String },
    desc: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Field', FieldSchema);
