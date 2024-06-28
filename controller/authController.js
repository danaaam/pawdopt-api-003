const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const User = require('../models/user');
const multer = require('multer');
const path = require('path');


const createToken = (_id, email) => {
  return jwt.sign({_id, email}, process.env.SECRET, { expiresIn: '3d' })
}


//log in user
const login = async (req, res) => {
  const {email, password, role, lastname, firstname, contactinfo, address} = req.body;


  try {
    const user = await User.login(email, password, role, firstname, lastname, address, contactinfo);


    const token = createToken(user._id, user.email);
 
    res.status(200).json({
      email: user.email,
      token,
      role: user.role,
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      address: user.address,
      contactinfo: user.contactinfo,
    });
  } catch (error) {
    res.status(400).json({error: error.message});
  }


}


// Set up Multer
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});


const upload = multer({ storage: storage }).single('validDocs');




const register = async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      // Handle multer error
      return res.status(500).json({ error: "An error occurred while uploading the file." });
    }


    // Extract user data and file path from request
    const { firstname, lastname, email, password, contactinfo, currentAddress, permanentAddress, facebook, middlename = '', suffix} = req.body;
    const { id } = req.params;
    const filePath = req.file ? req.file.path : null;


    try {
      // Save user data to the database, including the file path
      const user = await User.register(firstname, lastname, email, password, contactinfo, currentAddress, permanentAddress, facebook, middlename, suffix, filePath);
      const token = createToken(user._id);


      res.status(200).json({ email, token, id });
    } catch (error) {
      res.status(400).json({ error: error.message });
      console.error(error);
    }
  });
};


//sender
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});


//nodemaler sender of verification code
const sendVerificationEmail = (email, code) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Email Verification',
    text: `Your verification code is: ${code}`,
  };


  return transporter.sendMail(mailOptions);
};




// send code for verification
const requestVerificationCode = async (req, res) => {
  const { email } = req.body;


  try {
    const generateVerificationCode = () => {
      return Math.floor(100000 + Math.random() * 900000);
    };


    const user = await User.findOne({ email: email.toLowerCase() });


    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }


    if (user.isVerified) {
      return res.status(400).json({ error: "User is already verified." });
    }


    // Generate verification code
    const verificationCode = generateVerificationCode();


    // Update user with the new verification code and timestamp
    user.verificationCode = verificationCode;
    user.verificationCodeGeneratedAt = new Date();
    await user.save();


    // Send verification email with the code
    await sendVerificationEmail(email, verificationCode);


    res.status(200).json({ message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.error(error);
  }
};


// verifying email
const verifyEmail = async (req, res) => {
  const { code, email } = req.query;


  console.log('Verification code:', code);
  console.log('Email:', email);


  try {
    const user = await User.findOne({
      email: email.toLowerCase(), // Ensure case-insensitive match
      verificationCode: code,
      isVerified: false,
    });


    if (!user) {
      console.log('User not found or code invalid');
      return res.status(400).json({ error: "Invalid or expired code." });
    }


    // Check if the code is expired (1 hour = 60 minutes * 60 seconds * 1000 milliseconds)
    const expirationTime = 60 * 60 * 1000;
    const currentTime = Date.now();
    const codeGenerationTime = new Date(user.verificationCodeGeneratedAt).getTime();


    if (currentTime - codeGenerationTime > expirationTime) {
      console.log('Code has expired');
      return res.status(400).json({ error: "Verification code has expired." });
    }


    // Mark user as verified
    user.isVerified = true;
    await user.save();


    console.log('Email verified successfully');
    res.status(200).json({ message: "Email verified successfully." });
  } catch (error) {
    console.error('Error in verification process:', error);
    return res.status(500).json({ error: "An error occurred during email verification." });
  }
};


//checker if email is verified
const checkVerificationStatus = async (req, res) => {
  const { email } = req.query;


  try {
    const user = await User.findOne({ email });


    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }


    res.status(200).json({ isVerified: user.isVerified });
  } catch (error) {
    res.status(500).json({ error: "Error checking verification status." });
    console.error(error);
  }
};




//edit user admin only
const editUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const update = req.body;


    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });


    if (!updatedUser) {
      return res.status(404).send('User not found');
    }


    res.json(updatedUser);
  } catch (error) {
    res.status(500).send('Server error');
  }
};








//delete user admin only
const deleteUser = async (req, res) => {
  const { id } = req.params;


  try {
    // Delete user
    const users = await User.findByIdAndDelete(id);


    if (!users) {
      return res.status(404).json({ error: "User not found" });
    }


    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}




//get all user admin only
const getAllUsers = async (req, res) => {
  try {
    // Get all users
    const users = await User.find();


    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({error: error.message});
  }
}


//verifying user admin side


const toggleUserVerification = async (req, res) => {
  const { id } = req.params;
  const { verified, adminMessage } = req.body;


  try {
    const user = await User.findByIdAndUpdate(id, { verified, adminMessage }, { new: true });


    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    res.status(200).json({ verified: user.verified, adminMessage: user.adminMessage });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}








//user side check if account is verified


const checkVerification = async (req, res) => {
  try {
    const { id } = req.params;


    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    // Respond with the verification status and admin message
    res.status(200).json({ verified: user.verified, adminMessage: user.adminMessage });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};








  //reset password
const sendotp = async (req, res) => {
  console.log(req.body);
  const _otp = Math.floor(100000 + Math.random() * 900000);
  console.log(_otp);
 
  try {
      let user = await User.findOne({ email: req.body.email });
      if (!user) {
          return res.status(404).json({ code: 404, message: 'User not found' });
      }


      let testAccount = await nodemailer.createTestAccount();


      let transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
              user: testAccount.user,
              pass: testAccount.pass
          }
      });


      let info = await transporter.sendMail({
          from: 'pawdtop358@gmail.com',
          to: user.email, // Use user's email from the database
          subject: "OTP",
          text: String(_otp),
          html: `<html>
              <body>
                  <p>Hello and welcome</p>
                  <p>Your OTP is: ${_otp}</p>
              </body>
          </html>`,
      });


      if (info.messageId) {
          console.log(info, 84);
          await User.updateOne({ email: user.email }, { otp: _otp });
          res.status(200).json({ code: 200, message: 'OTP sent successfully', otp: _otp });
      } else {
          res.status(500).json({ code: 500, message: 'Failed to send OTP' });
      }
  } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ code: 500, message: 'Internal server error' });
  }
};




// enter new password
const submitotp = async (req, res) => {
  const { otp, password } = req.body;


  try {
      const user = await User.findOne({ otp });
      if (!user) {
          return res.status(404).json({ code: 404, message: 'Invalid OTP' });
      }


      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);


      // Update user's password with the hashed one
      user.password = hash;
      await user.save();


      // Clear OTP after password update
      user.otp = null;
      await user.save();


      res.status(200).json({ code: 200, message: 'Password updated' });
  } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ code: 500, message: 'Internal server error' });
  }
};


// get user by ID user
const getUserById = async (req, res) => {
  const { id } = req.params;


  try {
    const user = await User.findOne({_id: id});


    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


// Delete user by ID user
const deleteUserById = async (req, res) => {
  const { id } = req.params;


  try {
    const user = await User.findByIdAndDelete(id);


    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


const editUserById = async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, email, address, contactinfo, verified } = req.body;


  console.log(`Received request to update user with id ${id}:`, req.body);


  try {
    const user = await User.findByIdAndUpdate(
      id,
      { firstname, lastname, email, address, contactinfo, verified },
      { new: true }
    );


    if (!user) {
      console.error(`User with id ${id} not found`);
      return res.status(404).json({ error: "User not found" });
    }


    console.log(`User with id ${id} updated successfully:`, user);
    res.status(200).json(user);
  } catch (error) {
    console.error(`Error updating user with id ${id}:`, error.message);
    res.status(400).json({ error: error.message });
  }
};






module.exports = {login,
   register,
   editUser,
   deleteUser,
   getAllUsers,
   toggleUserVerification,
   checkVerification,
   sendotp,
   submitotp,
   editUserById,
   deleteUserById,
   getUserById,
   verifyEmail,
   sendVerificationEmail,
   checkVerificationStatus,
   requestVerificationCode};




