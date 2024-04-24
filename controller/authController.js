const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const User = require('../models/user');

const createToken = (_id, email) => {
  return jwt.sign({_id, email}, process.env.SECRET, { expiresIn: '3d' })
}

//log in user
const login = async (req, res) => {
  const {email, password, role, lastname, firstname, contactInfo, address} = req.body;

  try {
    const user = await User.login(email, password, role, firstname, lastname, address, contactInfo);

    const token = createToken(user._id, user.email);
  
    res.status(200).json({
      email: user.email,
      token,
      role: user.role,
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      address: user.address,
      contactinfo: user.contactInfo // Ensure consistent naming (contactInfo)
    });
  } catch (error) {
    res.status(400).json({error: error.message});
  }
}
//register user
const register = async (req, res) => {
  const {firstname, lastname, email, password, address, contactInfo, role} = req.body;
  const { id } = req.params;

  try {
    const user = await User.register(firstname, lastname, email, password, address, contactInfo, role);

    const token = createToken(user._id);

    res.status(200).json({email, token, id});
  } catch (error) {
    res.status(400).json({error: error.message});
  }
}

//edit user admin only
const editUser = async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, email, password, role } = req.body;

  try {
    // Update user details
    const users = await User.findByIdAndUpdate(id, { firstname, lastname, email, password, role }, { new: true });

    if (!users) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


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

// Edit user by ID user
const editUserById = async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, email, address, contactinfo } = req.body;

  try {
    const user = await User.findByIdAndUpdate(id, { 
      firstname, 
      lastname, 
      email, 
      address, 
      contactinfo 
    }, { new: true });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


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
   getUserById};
