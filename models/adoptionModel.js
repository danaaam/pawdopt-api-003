const mongoose = require('mongoose');

const AdoptionRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users' 
  },
 name: String,
 email: String,
 contactInfo: String,
 address: String,
 adoptionRequests: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'UserGallery'
}],
status: {
  type: String,
  default: 'pending',
  enum: [ 'pending', 'approved', 'rejected'],
  },
adminMessage: {
  type: String,
  maxlength: 255
}


}, { timestamps: true });

const AdoptionRequestModel = mongoose.model('AdoptionRequest', AdoptionRequestSchema);

module.exports = AdoptionRequestModel;
