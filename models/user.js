const mongoose = require('mongoose');
const bcrypt = require('bcrypt')
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
      'Sr.','Jr.','II','III','IV'
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
    type: String,
    required: true
  },
  adminMessage: String,
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
      



userSchema.statics.register = async function(firstname ,lastname, middlename, suffix, validDocs, email, password, address, contactinfo, currentAddress, permanentAddress) {

  // validation
  if (!firstname || !lastname || !email || !password|| !address || !contactinfo || !validDocs || !currentAddress || !permanentAddress) {

    throw Error('All fields must be filled')
  }

  const exists = await this.findOne({ email })

  if (exists) {
    throw Error('Email already in use')
  }
  if (!validator.isStrongPassword(password)) {
    throw Error('Password not strong enough')
  }

  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(password, salt)

  const user = await this.create({ firstname, middlename, suffix, validDocs, lastname, email, password: hash, address, contactinfo, currentAddress, permanentAddress})

  return user
}

// static login method
userSchema.statics.login = async function(email, password) {

  if (!email || !password) {
    throw Error('All fields must be filled')
  }

  const user = await this.findOne({ email })
  if (!user) {
    throw Error('Incorrect email')
  }

  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    throw Error('Incorrect password')
  }

  return user
}

module.exports = mongoose.model('Users', userSchema)
