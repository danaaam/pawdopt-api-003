const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  firstname: { 
    type: String, 
    required: true 
  }, 
  middlename: { 
    type: String
  },
  lastname: { 
    type: String, 
    required: true 
  },
  suffix: {
    type: String,
    enum: [
      '','Sr.','Jr.','II','III','IV'
    ]
  },
  email: { 
    type: String, 
    required: true 
  },
  facebook: {
    type: String,
    required: true
  },
  password: { 
    type: String, 
    required: true
  },
  currentAddress: { 
    type: String, 
    required: true 
  },
  permanentAddress: {
    type: String, 
    required: true 
  },
  contactinfo: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String,
    default: "user"
  },
  verified: {
    type: Boolean,
    default: false
  },
  validDocs: {
    type: String
  },
  otp: { type: Number } 
}, { strictPopulate: false });

userSchema.statics.submitotp = async function(password, next) {
  const user = this;

  if (!user.isModified('password')) {
      return next();
  }

  if (!validator.isStrongPassword(password)) {
      const error = new Error('Password not strong enough');
      return next(error);
  }

  try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      user.password = hash;
      next();
  } catch (error) {
      next(error);
  }
};

userSchema.statics.register = async function(firstname, lastname, email, password, contactinfo, currentAddress, permanentAddress, facebook, middlename = '', suffix, validDocs = '') {
  // Validation
  if (!firstname || !lastname || !email || !password || !contactinfo || !currentAddress || !permanentAddress || !facebook) {
    throw new Error('All required fields must be filled');
  }

  // Check if email is already in use
  const exists = await this.findOne({ email });
  if (exists) {
    throw new Error('Email already in use');
  }

  // Check password strength
  if (!validator.isStrongPassword(password)) {
    throw new Error('Password not strong enough');
  }

  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  // Create user
  const user = await this.create({
    firstname,
    middlename,
    lastname,
    suffix,
    validDocs,
    email,
    password: hash,
    contactinfo,
    currentAddress,
    permanentAddress,
    facebook
  });

  return user;
};


// Static login method
userSchema.statics.login = async function(email, password) {
  if (!email || !password) {
    throw Error('All fields must be filled');
  }

  const user = await this.findOne({ email });
  if (!user) {
    throw Error('Incorrect email');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw Error('Incorrect password');
  }

  return user;
};

module.exports = mongoose.model('Users', userSchema);
