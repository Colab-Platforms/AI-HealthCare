const mongoose = require('mongoose');

const supplementMappingSchema = new mongoose.Schema({
  deficiency: { type: String, required: true },
  supplements: [{
    category: { type: String, required: true },
    description: String,
    generalDosage: String,
    notes: String
  }],
  isEnabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SupplementMapping', supplementMappingSchema);
