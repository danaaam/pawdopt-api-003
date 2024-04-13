const jwt = require('jsonwebtoken');
const User = require('../models/user');

const requireAuth = async (req, res, next) => {
  // Verify if the user is authenticated
  const { authorization } = req.headers;

  // If authorization token is missing, return 401 Unauthorized error
  if (!authorization) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authorization.split(' ')[1];

  try {
    // Verify the JWT token using the secret key
    const { _id } = jwt.verify(token, process.env.SECRET);

    // Find the user associated with the token and attach it to the request object
    req.user = await User.findOne({ _id }).select('_id');

    if (!req.user) {
      return res.status(401).json({ error: 'User not found' });
    }

    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Request is not authorized' });
  }
};

module.exports = requireAuth;
