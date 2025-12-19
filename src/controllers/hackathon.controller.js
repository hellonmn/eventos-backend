const Hackathon = require('../models/Hackathon');
const User = require('../models/User');
const Team = require('../models/Team');
const emailService = require('../services/email.service');
const crypto = require('crypto');

// @desc    Create hackathon
// @route   POST /api/hackathons
// @access  Private (Admin, Organizer with subscription)
exports.createHackathon = async (req, res) => {
  try {
    const bypassCheck = process.env.BYPASS_SUBSCRIPTION_CHECK === 'true' || process.env.NODE_ENV === 'development';
    
    // Check if user can create hackathons
    if (!req.user.hasAnyRole(['admin', 'super_admin']) && !bypassCheck) {
      // Only check subscription if not in bypass mode
      if (!req.user.subscription || 
          !req.user.subscription.features.canCreateHackathons || 
          req.user.subscription.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Active subscription with hackathon creation permission required',
          hint: 'Set BYPASS_SUBSCRIPTION_CHECK=true in .env to bypass this check in development'
        });
      }
    }

    // Set organizer
    req.body.organizer = req.user._id;
    req.body.organizerDetails = {
      name: req.user.fullName,
      email: req.user.email,
      phone: req.user.phone,
      organization: req.user.institution
    };

    const hackathon = await Hackathon.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Hackathon created successfully',
      hackathon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all hackathons
// @route   GET /api/hackathons
// @access  Public
exports.getHackathons = async (req, res) => {
  try {
    const { status, mode, search, page = 1, limit = 10, featured } = req.query;

    const query = { isPublic: true };

    if (status) query.status = status;
    if (mode) query.mode = mode;
    if (featured === 'true') query.isFeatured = true;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const hackathons = await Hackathon.find(query)
      .populate('organizer', 'fullName institution')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Hackathon.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      hackathons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single hackathon
// @route   GET /api/hackathons/:id
// @access  Public
exports.getHackathon = async (req, res) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id)
      .populate('organizer', 'fullName email institution profile')
      .populate('coordinators.user', 'fullName email')
      .populate('judges.user', 'fullName email');

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Increment views
    hackathon.views += 1;
    await hackathon.save();

    res.status(200).json({
      success: true,
      hackathon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update hackathon
// @route   PUT /api/hackathons/:id
// @access  Private (Organizer, Admin)
exports.updateHackathon = async (req, res) => {
  try {
    let hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Check authorization
    if (hackathon.organizer.toString() !== req.user._id.toString() && 
        !req.user.hasAnyRole(['admin', 'super_admin'])) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this hackathon'
      });
    }

    hackathon = await Hackathon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Hackathon updated successfully',
      hackathon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete hackathon
// @route   DELETE /api/hackathons/:id
// @access  Private (Organizer, Admin)
exports.deleteHackathon = async (req, res) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Check authorization
    if (hackathon.organizer.toString() !== req.user._id.toString() && 
        !req.user.hasAnyRole(['admin', 'super_admin'])) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this hackathon'
      });
    }

    await hackathon.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Hackathon deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my hackathons (as organizer)
// @route   GET /api/hackathons/my/organized
// @access  Private
exports.getMyHackathons = async (req, res) => {
  try {
    const hackathons = await Hackathon.find({ organizer: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: hackathons.length,
      hackathons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my coordinations
// @route   GET /api/hackathons/my/coordinations
// @access  Private
exports.getMyCoordinations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'coordinatorFor.hackathon',
        select: 'title slug status hackathonStartDate hackathonEndDate mode'
      });

    const coordinations = user.coordinatorFor
      .filter(coord => coord.status === 'accepted')
      .map(coord => ({
        hackathon: coord.hackathon,
        permissions: coord.permissions,
        invitedAt: coord.invitedAt,
        acceptedAt: coord.acceptedAt
      }));

    res.status(200).json({
      success: true,
      count: coordinations.length,
      coordinations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Invite coordinator
// @route   POST /api/hackathons/:id/coordinators/invite
// @access  Private (Organizer, Admin)
exports.inviteCoordinator = async (req, res) => {
  try {
    const { emailOrUsername, permissions } = req.body;
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Find user
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already a coordinator
    const existingCoord = user.coordinatorFor.find(
      c => c.hackathon.toString() === hackathon._id.toString()
    );

    if (existingCoord) {
      return res.status(400).json({
        success: false,
        message: 'User is already a coordinator for this hackathon'
      });
    }

    // Add to user's coordinatorFor
    const token = crypto.randomBytes(32).toString('hex');
    user.coordinatorFor.push({
      hackathon: hackathon._id,
      permissions: permissions || {},
      invitedBy: req.user._id,
      invitedAt: new Date(),
      status: 'pending'
    });
    await user.save();

    // Send invitation email
    await emailService.sendCoordinatorInvitation(user, hackathon, req.user, token);

    res.status(200).json({
      success: true,
      message: 'Coordinator invitation sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Accept coordinator invitation
// @route   POST /api/hackathons/coordinators/accept/:token
// @access  Private
exports.acceptCoordinatorInvitation = async (req, res) => {
  try {
    const { hackathonId } = req.body;

    const user = await User.findById(req.user._id);
    const coordination = user.coordinatorFor.find(
      c => c.hackathon.toString() === hackathonId && c.status === 'pending'
    );

    if (!coordination) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    coordination.status = 'accepted';
    coordination.acceptedAt = new Date();
    
    // Add coordinator role if not present
    if (!user.roles.includes('coordinator')) {
      user.roles.push('coordinator');
    }

    await user.save();

    // Add to hackathon's coordinators list
    const hackathon = await Hackathon.findById(hackathonId);
    hackathon.coordinators.push({
      user: user._id,
      permissions: coordination.permissions,
      addedAt: new Date()
    });
    await hackathon.save();

    res.status(200).json({
      success: true,
      message: 'Coordinator invitation accepted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update coordinator permissions
// @route   PUT /api/hackathons/:id/coordinators/:userId/permissions
// @access  Private (Organizer, Admin)
exports.updateCoordinatorPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    const coordinator = hackathon.coordinators.find(
      c => c.user.toString() === req.params.userId
    );

    if (!coordinator) {
      return res.status(404).json({
        success: false,
        message: 'Coordinator not found'
      });
    }

    coordinator.permissions = { ...coordinator.permissions, ...permissions };
    await hackathon.save();

    // Update in user model
    const user = await User.findById(req.params.userId);
    const userCoord = user.coordinatorFor.find(
      c => c.hackathon.toString() === hackathon._id.toString()
    );
    if (userCoord) {
      userCoord.permissions = coordinator.permissions;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Coordinator permissions updated successfully',
      permissions: coordinator.permissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Invite judge
// @route   POST /api/hackathons/:id/judges/invite
// @access  Private (Organizer, Admin)
exports.inviteJudge = async (req, res) => {
  try {
    const { emailOrUsername, assignedRounds } = req.body;
    const hackathon = await Hackathon.findById(req.params.id);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Find user
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already a judge
    const existingJudge = user.judgeFor.find(
      j => j.hackathon.toString() === hackathon._id.toString()
    );

    if (existingJudge) {
      return res.status(400).json({
        success: false,
        message: 'User is already a judge for this hackathon'
      });
    }

    // Add to user's judgeFor
    const token = crypto.randomBytes(32).toString('hex');
    user.judgeFor.push({
      hackathon: hackathon._id,
      invitedBy: req.user._id,
      invitedAt: new Date(),
      status: 'pending'
    });
    await user.save();

    // Send invitation email
    await emailService.sendJudgeInvitation(user, hackathon, req.user, token);

    res.status(200).json({
      success: true,
      message: 'Judge invitation sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Accept judge invitation
// @route   POST /api/hackathons/judges/accept/:token
// @access  Private
exports.acceptJudgeInvitation = async (req, res) => {
  try {
    const { hackathonId } = req.body;

    const user = await User.findById(req.user._id);
    const judgeEntry = user.judgeFor.find(
      j => j.hackathon.toString() === hackathonId && j.status === 'pending'
    );

    if (!judgeEntry) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    judgeEntry.status = 'accepted';
    judgeEntry.acceptedAt = new Date();
    
    // Add judge role if not present
    if (!user.roles.includes('judge')) {
      user.roles.push('judge');
    }

    await user.save();

    // Add to hackathon's judges list
    const hackathon = await Hackathon.findById(hackathonId);
    hackathon.judges.push({
      user: user._id,
      name: user.fullName,
      bio: user.profile?.bio,
      photo: user.profile?.avatar,
      expertise: user.profile?.skills
    });
    await hackathon.save();

    res.status(200).json({
      success: true,
      message: 'Judge invitation accepted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
