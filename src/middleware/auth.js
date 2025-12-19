const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const hasRole = roles.some(role => req.user.roles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.roles.join(', ')}' is not authorized to access this route`
      });
    }

    next();
  };
};

// Check if user is organizer of hackathon
exports.isOrganizer = async (req, res, next) => {
  try {
    const Hackathon = require('../models/Hackathon');
    const hackathonId = req.params.hackathonId || req.body.hackathon;

    const hackathon = await Hackathon.findById(hackathonId);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    if (hackathon.organizer.toString() !== req.user._id.toString() && 
        !req.user.hasAnyRole(['admin', 'super_admin'])) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized as organizer of this hackathon'
      });
    }

    req.hackathon = hackathon;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking organizer status'
    });
  }
};

// Check if user is coordinator for hackathon
exports.isCoordinator = async (req, res, next) => {
  try {
    const Hackathon = require('../models/Hackathon');
    const hackathonId = req.params.hackathonId || req.body.hackathon;

    const hackathon = await Hackathon.findById(hackathonId);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Check if user is organizer, admin, or coordinator
    const isOrganizer = hackathon.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.hasAnyRole(['admin', 'super_admin']);
    const isCoord = req.user.isCoordinatorFor(hackathonId);

    if (!isOrganizer && !isAdmin && !isCoord) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized as coordinator for this hackathon'
      });
    }

    req.hackathon = hackathon;
    req.coordinatorPermissions = req.user.getCoordinatorPermissions(hackathonId);
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking coordinator status'
    });
  }
};

// Check if user is judge for hackathon
exports.isJudge = async (req, res, next) => {
  try {
    const Hackathon = require('../models/Hackathon');
    const hackathonId = req.params.hackathonId || req.body.hackathon;

    const hackathon = await Hackathon.findById(hackathonId);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Check if user is organizer, admin, or judge
    const isOrganizer = hackathon.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.hasAnyRole(['admin', 'super_admin']);
    const isJudge = req.user.isJudgeFor(hackathonId);

    if (!isOrganizer && !isAdmin && !isJudge) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized as judge for this hackathon'
      });
    }

    req.hackathon = hackathon;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking judge status'
    });
  }
};

// Check coordinator permission for specific action
exports.checkCoordinatorPermission = (permission) => {
  return (req, res, next) => {
    // Organizers and admins have all permissions
    if (req.hackathon.organizer.toString() === req.user._id.toString() || 
        req.user.hasAnyRole(['admin', 'super_admin'])) {
      return next();
    }

    // Check coordinator permissions
    if (!req.coordinatorPermissions || !req.coordinatorPermissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${permission.replace('can', '').toLowerCase()}`
      });
    }

    next();
  };
};

// Check subscription features
exports.checkSubscriptionFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user.subscription || 
        req.user.subscription.status !== 'active' || 
        !req.user.subscription.features[feature]) {
      return res.status(403).json({
        success: false,
        message: `This feature requires an active subscription with ${feature} enabled`,
        upgradeRequired: true
      });
    }
    next();
  };
};

module.exports = exports;
