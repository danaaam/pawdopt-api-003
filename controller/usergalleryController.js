const UserGallery = require('../models/usergalleryModel');
const AdoptionModel = require('../models/adoptionModel');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');




const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, './uploads/');
        } else if (file.mimetype === 'application/pdf') {
            cb(null, './files/');
        } else {
            cb(new Error('File type not supported'), false);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});


const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('File type not supported'), false);
        }
    }
});


const userHandleupload = async (req, res) => {
    try {
        const { breed, caption, gender, age, medhistory, others, species, pet_status } = req.body;


        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }


        const files = req.files.map(file => ({
            filename: file.filename,
            mimetype: file.mimetype
        }));


        const imageUrls = files.filter(file => file.mimetype.startsWith('image/')).map(file => file.filename);
        const pdfUrls = files.filter(file => file.mimetype === 'application/pdf').map(file => file.filename);


        const newItem = new UserGallery({
            imageUrls,
            pdfUrls,
            breed,
            gender,
            caption,
            age,
            medhistory,
            user_id: req.user._id,
            user_email: req.user.email,
            user_facebook: req.user.facebook,
            others,
            species,
            pet_status
        });


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
        const usergalleryItems = await UserGallery.find({
            approved: false,
            pet_status: 'for adoption'
        })
        .sort({ createdAt: 1 })
        .select({
            _id: 1,
            imageUrls: 1,
            pdfUrls: 1,
            breed: 1,
            gender: 1,
            age: 1,
            caption: 1,
            species: 1,
            others: 1,
            medhistory: 1,
            user_id: 1,
            approved: 1,
            pet_status: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1
        })
        .lean(); // Convert query result to plain JavaScript objects


        res.json(usergalleryItems);
    } catch (error) {
        console.error('Error getting gallery:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};




// const usergetGallery = async (req, res) => {
//     try {
//         const usergalleryItems = await UserGallery.find({
//             approved: false,
//             pet_status: 'for adoption'
//         }).sort({ createdAt: 1 });


//         res.json(usergalleryItems);
//     } catch (error) {
//         console.error('Error getting gallery:', error);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };


const adoptRequest = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]; // Get the token from the Authorization header


        // Decode the token to get user information
        const decodedToken = jwt.verify(token, process.env.SECRET);
        const userEmail = decodedToken.email;


        const { imageUrl, adoptionRequests, contactInfo, name, address, status } = req.body;


        // Ensure adoptionRequests is an array
        const adoptionRequestIds = Array.isArray(adoptionRequests) ? adoptionRequests : [adoptionRequests];


        // Create adoption data record
        const adoptionData = await AdoptionModel.create({ adoptionRequests: adoptionRequestIds, user_id: decodedToken._id, name, contactInfo, address, email: userEmail, status });


        // Update pet_status for each adoption request
        const updatePromises = adoptionRequestIds.map(async (adoptionRequestId) => {
            await UserGallery.findOneAndUpdate(
                { _id: adoptionRequestId },
                { $set: { pet_status: "on process" } }
            );
        });


        await Promise.all(updatePromises);


        const successResponse = {
            message: 'Adoption request submitted successfully',
            imageUrls: Array.isArray(imageUrl) ? imageUrl : [imageUrl], // Ensure imageUrls is an array
            user_id: decodedToken._id,
            email: userEmail,
            adoptionData
        };


        res.status(201).json(successResponse);
    } catch (error) {
        console.error('Error submitting adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}


const cancelAdoptRequest = async (req, res) => {
    try {
        const { id } = req.params;


        console.log(id)


        // Find the adoption request by ID and delete it
        const adoptionRequest = await AdoptionModel.findById(id);
        if (!adoptionRequest) {
            return res.status(404).json({ error: 'Adoption request not found' });
        }


        // Delete the adoption request
        await AdoptionModel.findByIdAndDelete(id);


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
        const petStatus = await AdoptionModel.find().populate('adoptionRequests').populate('adoptionRequests.user_id')
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
        console.log(id);


        if (!id) {
            return res.status(400).json({ error: 'Missing adoption request ID' });
        }


        // Update adoption request status and admin message
        const updatedRequest = await AdoptionModel.findByIdAndUpdate(id, { status: 'rejected', adminMessage }, { new: true });


        if (!updatedRequest) {
            return res.status(404).json({ error: 'Adoption request not found' });
        }


        // Update associated UserGallery records to set pet_status back to "for adoption"
        const adoptionRequestsIds = updatedRequest.adoptionRequests; // Assuming adoptionRequests is an array of UserGallery IDs
        if (adoptionRequestsIds && adoptionRequestsIds.length > 0) {
            await Promise.all(adoptionRequestsIds.map(async (id) => {
                await UserGallery.findByIdAndUpdate(id, { pet_status: 'for adoption' });
            }));
        }


        res.status(200).json({ message: 'Adoption request declined successfully' });
    } catch (error) {
        console.error('Error declining adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const restoreRequest = async (req, res) => {
    try {
        const { id } = req.params;
       
        console.log(id);


        if (!id) {
            return res.status(400).json({ error: 'Missing adoption request ID' });
        }


        // Update adoption request status and admin message
        const updatedRequest = await AdoptionModel.findByIdAndUpdate(id, { status: 'pending' }, { new: true });


        if (!updatedRequest) {
            return res.status(404).json({ error: 'Adoption request not found' });
        }


        // Update associated UserGallery records to set pet_status back to "for adoption"
        const adoptionRequestsIds = updatedRequest.adoptionRequests; // Assuming adoptionRequests is an array of UserGallery IDs
        if (adoptionRequestsIds && adoptionRequestsIds.length > 0) {
            await Promise.all(adoptionRequestsIds.map(async (id) => {
                await UserGallery.findByIdAndUpdate(id, { pet_status: 'on process' });
            }));
        }


        res.status(200).json({ message: 'Adoption request restored successfully' });
    } catch (error) {
        console.error('Error declining adoption request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const getAdoptionRequestById = async (req, res) => {
    try {
        const userId = req.user._id; // Access the user ID from the decoded JWT payload


        if (!userId) {
            return res.status(404).json({ message: 'user_id not found' });
        }


        // Find adoption requests associated with the user ID
        const requests = await AdoptionModel.find({ user_id: userId }).populate('adoptionRequests').populate('User');


        if (!requests || requests.length === 0) {
            return res.status(404).json({ message: 'No adoption requests found for this user' });
        }


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
                    _id: '$_id', // Group by the original _id of UserGallery
                    imageUrls: { $first: '$imageUrls' },
                    breed: { $first: '$breed' },
                    gender: { $first: '$gender' },
                    age: { $first: '$age' },
                    caption: { $first: '$caption' },
                    species: { $first: '$species' },
                    others: { $first: '$others' },
                    medhistory: { $first: '$medhistory' },
                    user_id: { $first: '$user_id' },
                    approved: { $first: '$approved' },
                    pet_status: { $first: 'for adoption' }, // Set 'pet_status' to 'for adoption'
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                    __v: { $first: '$__v' }
                }
            },
            {
                $project: {
                    _id: 1,
                    imageUrls: 1,
                    breed: 1,
                    gender: 1,
                    age: 1,
                    caption: 1,
                    species: 1,
                    others: 1,
                    medhistory: { $arrayElemAt: ['$medhistory', 0] }, // Get the first element of 'medhistory' array
                    user_id: 1,
                    approved: 1,
                    pet_status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1
                }
            }
        ]);


        if (usergalleryItems.length > 0) {
            res.json(usergalleryItems[0]); // Return the first item (assuming only one item per _id)
        } else {
            res.json(null); // Return null if no items found
        }
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
        // Find all adoption requests
        const adoptionRequests = await AdoptionModel.find();


        // Extract unique pet IDs from adoption requests
        const petIds = [...new Set(adoptionRequests.map((request) => request.pet_id))];


        // Log pet IDs for debugging
        console.log('Pet IDs:', petIds);


        // Check if petIds array is empty
        if (petIds.length === 0) {
            throw new Error('No pet IDs found in adoption requests.');
        }


        // Delete all adoption requests
        await AdoptionModel.deleteMany();


        // Update the pet_status for associated pets in UserGallery
        const updateResult = await UserGallery.updateMany(
            { _id: { $in: petIds } },
            { $set: { pet_status: 'for adoption' } }
        );


        // Log number of updated documents
        console.log(`${updateResult.nModified} UserGallery documents updated`);


        // Respond with success message
        res.status(200).json({ success: true, message: 'All adoption requests deleted successfully' });
    } catch (error) {
        console.error('Error deleting adoption requests:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const editGalleryItem = async (req, res) => {
    const { id } = req.params;
    const { caption, breed, age, others, species, medhistory, gender, imageUrls, pdfUrls } = req.body;
 
    try {
      let updatedFields = { caption, breed, age, others, species, medhistory: medhistory.split(", "), gender, imageUrls, pdfUrls };
 
      // Check if image files were uploaded and update accordingly
      if (req.files && req.files.image && req.files.image.length > 0) {
        updatedFields.imageUrls = req.files.image.map(file => file.filename);
      }
 
      // Check if a PDF file was uploaded and update accordingly
      if (req.files && req.files.pdf && req.files.pdf.length > 0) {
        updatedFields.pdfUrls = req.files.pdf[0].filename;
      }
 
      console.log('Updated fields:', updatedFields);
 
      const updatedImage = await UserGallery.findByIdAndUpdate(id, updatedFields, { new: true });
      res.json(updatedImage);
    } catch (error) {
      console.error('Error updating image:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
 


 
 


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
      deleteAllGallery,
      restoreRequest,  // Add the new controller function here
      editGalleryItem
  };

