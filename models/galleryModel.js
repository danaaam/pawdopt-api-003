const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
  },
  caption: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  user_id: {
    type: String,
    required: true
  }
}, { timestamps: true })

const Gallery = mongoose.model('Gallery', gallerySchema);

module.exports = Gallery;
