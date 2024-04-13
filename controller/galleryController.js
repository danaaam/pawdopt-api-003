const Gallery = require('../models/galleryModel');
const multer = require('multer');
const path = require('path');

// Set up Multer
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const handleUpload = async (req, res) => {
  try {
    const { category, caption } = req.body;
    const imageUrl = req.file.filename;
    const user_id = req.user._id;

    const newItem = new Gallery({ category, caption, imageUrl, user_id });
    await newItem.save();

    res.status(201).json({ success: true, message: 'Upload successful', newItem });
  } catch (error) {
    console.error('Error handling upload:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getGallery = async (req, res) => {
  try {
    const galleryItems = await Gallery.find();
    res.json(galleryItems);
  } catch (error) {
    console.error('Error getting gallery:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const editImage = async (req, res) => {
  const { id } = req.params;
  const { caption } = req.body;

  try {
    const updatedFields = { caption };
    if (req.file) {
      updatedFields.imageUrl = req.file.filename;
    }

    const updatedImage = await Gallery.findByIdAndUpdate(id, updatedFields, { new: true });
    if (!updatedImage) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    res.json({ success: true, message: 'Image updated successfully', updatedImage });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};

const deleteImage = async (req, res) => {
  const { id } = req.params;
  console.log('Deleting image with ID:', id);

  try {
    const deletedImage = await Gallery.findByIdAndDelete(id);
    if (!deletedImage) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    res.json({ success: true, message: 'Image deleted successfully', deletedImage });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};

module.exports = { upload, handleUpload, getGallery, editImage, deleteImage };
