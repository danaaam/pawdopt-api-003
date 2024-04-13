const UserGallery = require('../models/usergalleryModel');
const AdoptionModel = require('../models/adoptionModel');
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

const userdeleteImage = async (req, res) => {
    const { id } = req.params;
    console.log('Deleting image with ID:', id);

    try {
        const deletedImage = await UserGallery.findByIdAndDelete(id);
        if (!deletedImage) {
            return res.status(404).json({ success: false, message: 'Image not found' });
        }
        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const userHandleupload = async (req, res) => {
    try {
        const { breed, gender, age, medhistory, others, species, pet_status } = req.body;
        
        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
    
        // Extract image filenames from req.files
        const imageUrls = req.files.map(file => file.filename);

        // Create a new UserGallery document with imageUrls and other data
        const newItem = new UserGallery({ 
            imageUrls,
            breed, 
            gender, 
            age, 
            medhistory,
            user_id: req.user._id, 
            user_email: req.user.email,
            others,
            species,
            pet_status
        });

        // Save the new UserGallery document to MongoDB
        await newItem.save();
        
        res.json({ success: true, message: 'Upload successful' });
    } catch (error) {
        console.error('Error handling upload:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};


const deleteAllGallery = async (req, res) => {
    try {
        // Use deleteMany without any filter to delete all documents in the collection
        const result = await UserGallery.deleteMany({});

        // Check the result to see how many documents were deleted
        if (result.deletedCount > 0) {
            res.json({
                success: true,
                message: `${result.deletedCount} gallery items deleted successfully`
            });
        } else {
            res.json({
                success: false,
                message: 'No gallery items found to delete'
            });
        }
    } catch (error) {
        console.error('Error deleting gallery:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const usergetGallery = async (req, res) => {
    try {
        const usergalleryItems = await UserGallery.aggregate([
            { $match: { approved: false, pet_status: 'for adoption' } },
            { $sort: { createdAt: 1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                        hour: { $hour: '$createdAt' },
                        minute: { $minute: '$createdAt' }, 
                        second: { $second: '$createdAt' } 
                    },
                    user_email: { $first: '$user.email' }, 
                    images: { $push: '$$ROOT' } 
                }
            }
        ]);
        res.json(usergalleryItems);
    } catch (error) {
        console.error('Error getting gallery:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const adoptRequest = async (req, res) => {
    try {
        const { user_id, email: user_email } = req.user;
        const { imageUrl, adoptionRequests, contactinfo, name, address, email, status } = req.body;

        const adoptionData = (await AdoptionModel.create({ adoptionRequests, user_id, name, contactinfo, address, email, status }));
        const adoptionRequest = await AdoptionModel.findById(adoptionRequests)
            .populate('adoptionRequests');

        const imageUrls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
        const updatePromises = adoptionRequests.map(adoptionRequestId =>
            UserGallery.findOneAndUpdate(
                { _id: adoptionRequestId },
                { $set: { pet_status: "on process" } }
            )
        );

        await Promise.all(updatePromises);

        const successResponse = {
            message: 'Adoption request submitted successfully',
            imageUrls,
            user_id,
            user_email,
            adoptionData
        };

        res.status(201).json(successResponse);
    } catch (error) {
        console.error('Error submitting adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const cancelAdoptRequest = async (req, res) => {
    try {
        const { adoptionRequestId } = req.params;

        // Find the adoption request by ID and delete it
        const adoptionRequest = await AdoptionModel.findById(adoptionRequestId);
        if (!adoptionRequest) {
            return res.status(404).json({ error: 'Adoption request not found' });
        }

        // Delete the adoption request
        await AdoptionModel.findByIdAndDelete(adoptionRequestId);

        // Update associated UserGallery records based on adoptionRequests
        const adoptionRequests = adoptionRequest.adoptionRequests; // Assuming adoptionRequests contains _id values
        const updatePromises = adoptionRequests.map(adoptionId =>
            UserGallery.findOneAndUpdate(
                { _id: adoptionId },
                { $set: { pet_status: "for adoption" } }
            )
        );

        await Promise.all(updatePromises);

        // Respond with success message
        res.status(200).json({ message: 'Adoption request canceled successfully' });
    } catch (error) {
        console.error('Error canceling adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const getadoptRequests = async (req, res) => {
    try {
        const petStatus = await AdoptionModel.find().populate('adoptionRequests')
        res.status(200).json(petStatus);
    } catch (error) {
        console.error('Error fetching adoption requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const approveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminMessage } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Missing adoption request ID' });
        }

        const updatedRequest = await AdoptionModel.findByIdAndUpdate(id, { status: 'approved', adminMessage }, { new: true });

        if (!updatedRequest) {
            return res.status(404).json({ error: 'Adoption request not found' });
        }

        res.status(200).json({ message: 'Adoption request approved successfully' });
    } catch (error) {
        console.error('Error approving adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const declineRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminMessage } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Missing adoption request ID' });
        }

        const updatedRequest = await AdoptionModel.findByIdAndUpdate(id, { status: 'rejected', adminMessage }, { new: true });

        if (!updatedRequest) {
            return res.status(404).json({ error: 'Adoption request not found' });
        }

        res.status(200).json({ message: 'Adoption request declined successfully' });
    } catch (error) {
        console.error('Error declining adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAdoptionRequestById = async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await AdoptionModel.find({ user_id: userId });
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching adoption requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getPendingImagesAdoption = async (req, res) => {
    try {
        const usergalleryItems = await UserGallery.aggregate([
            { $match: { pet_status: 'on process' } },
            { $sort: { createdAt: 1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                        hour: { $hour: '$createdAt' },
                        minute: { $minute: '$createdAt' }, 
                        second: { $second: '$createdAt' } 
                    },
                    user_email: { $first: '$user.email' }, 
                    images: { $push: '$$ROOT' } 
                }
            }
        ]);
        res.json(usergalleryItems);
    } catch (error) {
        console.error('Error fetching pending images:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

//admin get the image for approval before it gets postd in user side
  // const getPendingImages = async (req, res) => {
  //   try {
  //     const usergalleryItems = await UserGallery.aggregate([
  //       {
  //         $match: { approved: false },
  //         $match: { pet_status: 'pending'}
  //       },
  //       {
  //         $sort: { createdAt: 1 } 
  //       },
  //       {
  //         $lookup: {
  //           from: 'users',
  //           localField: 'user_id',
  //           foreignField: '_id',
  //           as: 'user'
  //         }
  //       },
  //       {
  //         $unwind: '$user'
  //       },
  //       {
  //         $group: {
  //           _id: {
  //             year: { $year: '$createdAt' },
  //             month: { $month: '$createdAt' },
  //             day: { $dayOfMonth: '$createdAt' },
  //             hour: { $hour: '$createdAt' },
  //             minute: { $minute: '$createdAt' }, 
  //             second: { $second: '$createdAt' } 
  //           },
  //           user_email: { $first: '$user.email' }, 
  //           images: { $push: '$$ROOT' } 
  //         }
  //       }
  //     ]); 
  //     res.json(usergalleryItems);
  //   } catch (error) {
  //     console.error('Error fetching pending images:', error);
  //     res.status(500).json({ message: 'Internal server error' });
  //   }
  // };

  //admin approve image the image for approval before it gets postd in user side
  // const approveImage = async (req, res) => {
  //   const { id } = req.params;
  
  //   try {
  //     const image = await UserGallery.findByIdAndUpdate(
  //       id,
  //       { approved: true, pet_status: "for adoption" },
  //       { new: true }
  //     );
  
  //     if (!image) {
  //       return res
  //         .status(404)
  //         .json({ success: false, message: "Image not found" });
  //     }
  
  //     res.json({
  //       success: true,
  //       message: "Image approved successfully",
  //       image,
  //     });
  //   } catch (error) {
  //     console.error("Error approving image:", error);
  //     res.status(500).json({ success: false, message: "Internal Server Error" });
  //   }
  // };
  
  

  //admin decline the image for approval before it gets postd in user side
  // const declineImage = async (req, res) => {
  //   const { id } = req.params;
  
  //   try {
  //     const image = await UserGallery.findByIdAndUpdate(id, { approved: false, pet_status: "declined"}, { new: false });
  //     if (!image) {
  //       return res.status(404).json({ success: false, message: 'Image not found' });
  //     }
  //     res.json({ success: true, message: 'Image declined successfully', image });
  //   } catch (error) {
  //     console.error('Error declining image:', error);
  //     res.status(500).json({ success: false, message: 'Internal Server Error' });
  //   }
  // };


  const deleteAllAdoptionRequests = async (req, res) => {
      try {
          // Delete all adoption requests
          await AdoptionModel.deleteMany({});
          
          res.status(200).json({ success: true, message: 'All adoption requests deleted successfully' });
      } catch (error) {
          console.error('Error deleting adoption requests:', error);
          res.status(500).json({ success: false, message: 'Internal server error' });
      }
  };
  
  module.exports = {
      upload,
      userHandleupload,
      usergetGallery,
      userdeleteImage,
      adoptRequest,
      getPendingImagesAdoption,
      getAdoptionRequestById,
      declineRequest,
      approveRequest,
      getadoptRequests,
      cancelAdoptRequest,
      deleteAllAdoptionRequests,
      deleteAllGallery  // Add the new controller function here
  };