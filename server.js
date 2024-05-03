require('dotenv').config()

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path"); 
const cookieParser = require("cookie-parser");
const bodyParser = require('body-parser');

// const userController = require('./controller/user');
const galleryController = require('./controller/galleryController');
const usergalleryController = require('./controller/usergalleryController');
const requireAuth = require('./middleware/requireAuth'); 
const authController = require('./controller/authController');
const app = express();


// Error handling middleware
// app.use((req, res, next) => {
//   console.log(req.path, req.method)
//   next()
// })

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Serve uploaded images from the 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//check on seclected port if the backend runs sucessfully
app.get("/", (req, res) => {
  res.send("ako to");
}); 

//login
app.post('/api/register', authController.register);
//register
app.post('/api/login' , authController.login);
//verification checker
app.get('/api/check-verification/:id', authController.checkVerification);
//reset password
app.post('/api/sendotp', authController.sendotp);
app.post('/api/submitotp', authController.submitotp);

//admin get, edit, delete user admin side
app.get('/api/getallusers', authController.getAllUsers);
app.patch('/api/edit/users/:id', authController.editUser);
app.delete('/api/delete/users/:id', authController.deleteUser)
//verifying users admin side
app.put('/api/toggle-verification/:id', authController.toggleUserVerification);
// user side get, edit, delete accont
app.get('/api/getuser/:id', authController.getUserById);
app.put('/api/edit/user/:id', authController.editUserById);
app.delete('/api/delete/user/:id', authController.deleteUserById)

//admin upload image crud
app.post('/api/upload',requireAuth , galleryController.upload.single('image'), galleryController.handleUpload);
app.get('/api/gallery', galleryController.getGallery);
app.put('/api/gallery/:id',requireAuth, galleryController.editImage);
// app.delete('/api/gallery/:id',requireAuth, galleryController.deleteImage);


//admin image approval to user's upload 
// app.get('/api/pending-images', usergalleryController.getPendingImages);
// app.put('/api/approve-image/:id', usergalleryController.approveImage);
// app.delete('/api/decline-image/:id', usergalleryController.declineImage);



//admmin upload image
app.post('/api/user/upload',requireAuth, usergalleryController.upload.array('images', 4), usergalleryController.userHandleupload);
app.get('/api/user/gallery', usergalleryController.usergetGallery);
app.delete('/api/user/gallery/:id',requireAuth, usergalleryController.userdeleteImage);
app.delete('/api/user/gallery/deleteForAdoption', usergalleryController.deleteAllGallery)
//adoption request (admin side)
app.put('/api/adoption/request/approve/:id', usergalleryController.approveRequest);
app.put('/api/adoption/request/decline/:id', usergalleryController.declineRequest);
app.put('/api/adoption/request/restore/:id', usergalleryController.restoreRequest);

app.get('/api/get/adoption/requests', usergalleryController.getadoptRequests);
app.get('/api/pets/for/adoption', usergalleryController.getPendingImagesAdoption)
//adoption request (user side)
app.post('/api/adoption/request',requireAuth ,usergalleryController.adoptRequest)
app.get('/api/get/adoption/request/:userId',requireAuth , usergalleryController.getAdoptionRequestById)
app.delete('/api/cancel/adoption/request/:id', requireAuth, usergalleryController.cancelAdoptRequest);
app.delete('/api/delete/all/adoption/requests', requireAuth, usergalleryController.deleteAllAdoptionRequests);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    // listen for requests
    app.listen(process.env.PORT, () => {
      console.log('connected to db & listening on port', process.env.PORT)
    })
  })
  .catch((error) => {
    console.log(error)
  })
