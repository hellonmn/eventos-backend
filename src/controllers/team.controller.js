const Team = require('../models/Team');
const Hackathon = require('../models/Hackathon');
const User = require('../models/User');
const JoinRequest = require('../models/JoinRequest');
const emailService = require('../services/email.service');

// @desc    Register team for hackathon
// @route   POST /api/teams/register
// @access  Private
exports.registerTeam = async (req, res) => {
  try {
    const { hackathonId, teamName, members, projectTitle, projectDescription } = req.body;

    const hackathon = await Hackathon.findById(hackathonId);
    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    // Check if registration is open
    if (!hackathon.isRegistrationOpen()) {
      return res.status(400).json({
        success: false,
        message: 'Registration is not open for this hackathon'
      });
    }

    // Check if user is already registered
    const existingTeam = await Team.findOne({
      hackathon: hackathonId,
      $or: [
        { leader: req.user._id },
        { 'members.user': req.user._id, 'members.status': 'active' }
      ]
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this hackathon'
      });
    }

    // Check if user is a coordinator (cannot participate as both)
    if (req.user.isCoordinatorFor(hackathonId)) {
      return res.status(400).json({
        success: false,
        message: 'Coordinators cannot participate in the hackathon'
      });
    }

    // Validate team size
    const totalMembers = members ? members.length + 1 : 1; // +1 for leader
    if (totalMembers < hackathon.teamConfig.minMembers || 
        totalMembers > hackathon.teamConfig.maxMembers) {
      return res.status(400).json({
        success: false,
        message: `Team size must be between ${hackathon.teamConfig.minMembers} and ${hackathon.teamConfig.maxMembers} members`
      });
    }

    // Check max teams limit
    if (hackathon.currentRegistrations >= hackathon.maxTeams) {
      return res.status(400).json({
        success: false,
        message: 'Maximum team limit reached for this hackathon'
      });
    }

    // Prepare team members
    const teamMembers = [
      {
        user: req.user._id,
        role: 'leader',
        status: 'active'
      }
    ];

    if (members && members.length > 0) {
      for (const memberId of members) {
        // Check if member is already in another team
        const memberInTeam = await Team.findOne({
          hackathon: hackathonId,
          'members.user': memberId,
          'members.status': 'active'
        });

        if (memberInTeam) {
          return res.status(400).json({
            success: false,
            message: 'One or more members are already registered in another team'
          });
        }

        teamMembers.push({
          user: memberId,
          role: 'member',
          status: 'active'
        });
      }
    }

    // Create team
    const team = await Team.create({
      hackathon: hackathonId,
      teamName,
      leader: req.user._id,
      members: teamMembers,
      projectTitle,
      projectDescription,
      registrationStatus: hackathon.settings.autoAcceptTeams ? 'approved' : 'pending',
      payment: {
        status: hackathon.registrationFee.amount > 0 ? 'pending' : 'completed',
        amount: hackathon.registrationFee.amount,
        currency: hackathon.registrationFee.currency
      }
    });

    // Update hackathon registration count
    hackathon.currentRegistrations += 1;
    await hackathon.save();

    // Populate team for response
    await team.populate('members.user', 'fullName email username');
    await team.populate('leader', 'fullName email username');

    // Send confirmation email
    try {
      await emailService.sendTeamRegistrationConfirmation(
        { teamName, members: teamMembers, leader: req.user },
        hackathon
      );
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Team registered successfully',
      team,
      requiresPayment: hackathon.registrationFee.amount > 0
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user's team for a specific hackathon
// @route   GET /api/teams/my/hackathon/:hackathonId
// @access  Private
exports.getUserTeamForHackathon = async (req, res) => {
  try {
    const { hackathonId } = req.params;

    const team = await Team.findOne({
      hackathon: hackathonId,
      $or: [
        { leader: req.user._id },
        { 'members.user': req.user._id, 'members.status': 'active' }
      ]
    })
      .populate('leader', 'fullName email username')
      .populate('members.user', 'fullName email username')
      .populate('hackathon', 'title');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Not registered for this hackathon'
      });
    }

    res.status(200).json({
      success: true,
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Search users for team invitation
// @route   GET /api/teams/hackathon/:hackathonId/search-users
// @access  Private
exports.searchUsersForTeam = async (req, res) => {
  try {
    const { hackathonId } = req.params;
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query must be at least 2 characters'
      });
    }

    // Find all users matching the search (not limited to hackathon participants)
    // Filter to include users with student role or no roles (defaults to student)
    const users = await User.find({
      $and: [
        {
          $or: [
            { fullName: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        },
        {
          _id: { $ne: req.user._id } // Exclude current user
        },
        {
          $or: [
            { roles: { $in: ['student'] } },
            { roles: { $size: 0 } },
            { roles: { $exists: false } }
          ]
        }
      ]
    })
      .select('fullName username email roles institution')
      .limit(50); // Increased limit to search more users

    console.log(`Found ${users.length} users matching search query: ${query}`);

    // Get all user IDs that are already in teams for this hackathon (for efficient filtering)
    const teamsInHackathon = await Team.find({
      hackathon: hackathonId,
      'members.status': 'active'
    }).select('members.user');

    const userIdsInTeams = new Set();
    teamsInHackathon.forEach(team => {
      team.members.forEach(member => {
        if (member.user) {
          userIdsInTeams.add(member.user.toString());
        }
      });
    });

    // Get all pending join requests for this team to show invite status
    const teamId = req.query.teamId; // Get teamId from query params
    const pendingRequests = teamId ? await JoinRequest.find({
      team: teamId,
      hackathon: hackathonId,
      status: 'pending'
    }).select('user') : [];

    const userIdsWithPendingRequests = new Set();
    pendingRequests.forEach(request => {
      if (request.user) {
        userIdsWithPendingRequests.add(request.user.toString());
      }
    });

    // Filter out users already in teams for this hackathon and add request status
    const usersNotInTeams = users
      .filter(user => !userIdsInTeams.has(user._id.toString()))
      .map(user => {
        const userObj = user.toObject();
        userObj.hasPendingRequest = userIdsWithPendingRequests.has(user._id.toString());
        // Ensure roles is always an array (default to student if empty)
        if (!userObj.roles || userObj.roles.length === 0) {
          userObj.roles = ['student'];
        }
        return userObj;
      });

    console.log(`Returning ${usersNotInTeams.length} users not in teams (after filtering)`);

    res.status(200).json({
      success: true,
      users: usersNotInTeams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Send join request to user
// @route   POST /api/teams/:teamId/join-requests
// @access  Private (Team Leader)
exports.sendJoinRequest = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;

    const team = await Team.findById(teamId).populate('hackathon');
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team leader
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team leader can send join requests'
      });
    }

    // Check if team is full
    if (team.members.length >= team.hackathon.teamConfig.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Team is already full'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already in a team for this hackathon
    const userTeam = await Team.findOne({
      hackathon: team.hackathon._id,
      'members.user': userId,
      'members.status': 'active'
    });

    if (userTeam) {
      return res.status(400).json({
        success: false,
        message: 'User is already in a team for this hackathon'
      });
    }

    // Check if request already exists
    const existingRequest = await JoinRequest.findOne({
      team: teamId,
      user: userId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Join request already sent to this user'
      });
    }

    // Create join request
    const joinRequest = await JoinRequest.create({
      team: teamId,
      user: userId,
      sender: req.user._id,
      hackathon: team.hackathon._id,
      message: `${req.user.fullName} has invited you to join their team "${team.teamName}"`
    });

    // Send notification email
    try {
      await emailService.sendJoinRequestNotification(user, team, req.user);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Join request sent successfully',
      joinRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get join requests for a team
// @route   GET /api/teams/:teamId/join-requests
// @access  Private (Team Leader)
exports.getJoinRequests = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team leader
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team leader can view join requests'
      });
    }

    const joinRequests = await JoinRequest.find({
      team: teamId,
      status: 'pending'
    })
      .populate('user', 'fullName email username')
      .populate('sender', 'fullName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      joinRequests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my join requests (as a user)
// @route   GET /api/teams/my/join-requests
// @access  Private
exports.getMyJoinRequests = async (req, res) => {
  try {
    const joinRequests = await JoinRequest.find({
      user: req.user._id,
      status: 'pending'
    })
      .populate('team', 'teamName')
      .populate('sender', 'fullName')
      .populate('hackathon', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      joinRequests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Accept join request
// @route   POST /api/teams/:teamId/join-requests/:requestId/accept
// @access  Private (User receiving request)
exports.acceptJoinRequest = async (req, res) => {
  try {
    const { teamId, requestId } = req.params;

    const joinRequest = await JoinRequest.findOne({
      _id: requestId,
      team: teamId,
      user: req.user._id,
      status: 'pending'
    }).populate('team').populate('hackathon');

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Join request not found'
      });
    }

    // Check if user is already in a team for this hackathon
    const existingTeam = await Team.findOne({
      hackathon: joinRequest.hackathon._id,
      'members.user': req.user._id,
      'members.status': 'active'
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You are already in a team for this hackathon'
      });
    }

    const team = await Team.findById(teamId).populate('hackathon');

    // Check if team is full
    if (team.members.length >= team.hackathon.teamConfig.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Team is already full'
      });
    }

    // Add user to team
    team.members.push({
      user: req.user._id,
      role: 'member',
      status: 'active',
      joinedAt: new Date()
    });

    await team.save();

    // Update join request status
    joinRequest.status = 'accepted';
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    // Reject all other pending requests for this user for the same hackathon
    await JoinRequest.updateMany(
      {
        user: req.user._id,
        hackathon: joinRequest.hackathon._id,
        status: 'pending',
        _id: { $ne: requestId }
      },
      {
        status: 'rejected',
        respondedAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: 'Successfully joined the team',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject join request
// @route   POST /api/teams/:teamId/join-requests/:requestId/reject
// @access  Private (User receiving request)
exports.rejectJoinRequest = async (req, res) => {
  try {
    const { teamId, requestId } = req.params;

    const joinRequest = await JoinRequest.findOne({
      _id: requestId,
      team: teamId,
      user: req.user._id,
      status: 'pending'
    });

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Join request not found'
      });
    }

    joinRequest.status = 'rejected';
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    res.status(200).json({
      success: true,
      message: 'Join request rejected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve team (Admin)
// @route   PUT /api/teams/:id/approve
// @access  Private (Admin, Organizer)
exports.approveTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate('hackathon');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check authorization
    const isOrganizer = team.hackathon.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.hasAnyRole(['admin', 'super_admin']);

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve teams'
      });
    }

    team.registrationStatus = 'approved';
    team.approvedAt = new Date();
    team.approvedBy = req.user._id;
    await team.save();

    // Send notification email
    try {
      const leader = await User.findById(team.leader);
      await emailService.sendTeamApprovalNotification(leader, team, team.hackathon);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Team approved successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject team (Admin)
// @route   PUT /api/teams/:id/reject
// @access  Private (Admin, Organizer)
exports.rejectTeam = async (req, res) => {
  try {
    const { reason } = req.body;
    const team = await Team.findById(req.params.id).populate('hackathon');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check authorization
    const isOrganizer = team.hackathon.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.hasAnyRole(['admin', 'super_admin']);

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject teams'
      });
    }

    team.registrationStatus = 'rejected';
    if (reason) {
      team.notes.push({
        author: req.user._id,
        content: `Rejection reason: ${reason}`,
        createdAt: new Date(),
        isPublic: true
      });
    }
    await team.save();

    // Send notification email
    try {
      const leader = await User.findById(team.leader);
      await emailService.sendTeamRejectionNotification(leader, team, team.hackathon, reason);
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Team rejected',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get teams for a hackathon
// @route   GET /api/teams/hackathon/:hackathonId
// @access  Private (Coordinator, Organizer, Judge)
exports.getTeamsByHackathon = async (req, res) => {
  try {
    const { hackathonId } = req.params;
    const { status, eliminated, page = 1, limit = 20 } = req.query;

    const query = { hackathon: hackathonId };
    if (status) query.registrationStatus = status;
    if (eliminated !== undefined) query.isEliminated = eliminated === 'true';

    const teams = await Team.find(query)
      .populate('leader', 'fullName email username institution')
      .populate('members.user', 'fullName email username institution')
      .populate('hackathon', 'title')
      .sort({ overallScore: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Team.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      teams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single team
// @route   GET /api/teams/:id
// @access  Private
exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('hackathon')
      .populate('leader', 'fullName email username institution profile')
      .populate('members.user', 'fullName email username institution profile')
      .populate('scores.judge', 'fullName email')
      .populate('notes.author', 'fullName');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.status(200).json({
      success: true,
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update team
// @route   PUT /api/teams/:id
// @access  Private (Team Leader)
exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate('hackathon');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team leader
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team leader can update team details'
      });
    }

    const { teamName, projectTitle, projectDescription, techStack } = req.body;

    // Check if team name change is allowed
    if (teamName && !team.hackathon.settings.allowTeamNameChange) {
      return res.status(400).json({
        success: false,
        message: 'Team name change is not allowed'
      });
    }

    if (teamName) team.teamName = teamName;
    if (projectTitle) team.projectTitle = projectTitle;
    if (projectDescription) team.projectDescription = projectDescription;
    if (techStack) team.techStack = techStack;

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Check-in team
// @route   POST /api/teams/:id/checkin
// @access  Private (Coordinator, Organizer)
exports.checkInTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    team.checkIn.isCheckedIn = true;
    team.checkIn.checkedInAt = new Date();
    team.checkIn.checkedInBy = req.user._id;

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team checked in successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Check-in team member
// @route   POST /api/teams/:id/members/:memberId/checkin
// @access  Private (Coordinator, Organizer)
exports.checkInMember = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const member = team.members.find(
      m => m.user.toString() === req.params.memberId
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in team'
      });
    }

    member.checkIn.isCheckedIn = true;
    member.checkIn.checkedInAt = new Date();
    member.checkIn.checkedInBy = req.user._id;

    // Check if all members are checked in
    const allCheckedIn = team.members.every(m => m.checkIn.isCheckedIn);
    if (allCheckedIn) {
      team.checkIn.allMembersCheckedIn = true;
    }

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Member checked in successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Assign table and team number
// @route   PUT /api/teams/:id/assign
// @access  Private (Coordinator, Organizer)
exports.assignTableAndTeamNumber = async (req, res) => {
  try {
    const { tableNumber, teamNumber } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (tableNumber) team.tableNumber = tableNumber;
    if (teamNumber) team.teamNumber = teamNumber;

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Table and team number assigned successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Submit project for round
// @route   POST /api/teams/:id/submit
// @access  Private (Team Member)
exports.submitProject = async (req, res) => {
  try {
    const { roundId, projectLink, demoLink, videoLink, presentationLink, githubRepo, description, techStack } = req.body;
    
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team member
    if (!team.isMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only team members can submit'
      });
    }

    // Check if already submitted for this round
    const existingSubmission = team.submissions.find(
      s => s.round.toString() === roundId
    );

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'Already submitted for this round'
      });
    }

    team.submissions.push({
      round: roundId,
      submittedAt: new Date(),
      submittedBy: req.user._id,
      projectLink,
      demoLink,
      videoLink,
      presentationLink,
      githubRepo,
      description,
      techStack,
      status: 'submitted'
    });

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Project submitted successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Score team (Judge)
// @route   POST /api/teams/:id/score
// @access  Private (Judge)
exports.scoreTeam = async (req, res) => {
  try {
    const { roundId, criteriaScores, remarks, feedback } = req.body;
    
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if judge already scored this team for this round
    const existingScore = team.scores.find(
      s => s.round.toString() === roundId && 
           s.judge.toString() === req.user._id.toString()
    );

    if (existingScore) {
      return res.status(400).json({
        success: false,
        message: 'You have already scored this team for this round'
      });
    }

    // Calculate total score
    const totalScore = criteriaScores.reduce((sum, c) => sum + c.score, 0);
    const maxPossibleScore = criteriaScores.reduce((sum, c) => sum + c.maxScore, 0);

    team.scores.push({
      round: roundId,
      judge: req.user._id,
      criteriaScores,
      totalScore,
      maxPossibleScore,
      remarks,
      feedback,
      isFinalized: true
    });

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team scored successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Eliminate team
// @route   POST /api/teams/:id/eliminate
// @access  Private (Organizer, Admin)
exports.eliminateTeam = async (req, res) => {
  try {
    const { roundId, reason } = req.body;
    
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    team.isEliminated = true;
    team.eliminatedAt = new Date();
    team.eliminatedInRound = roundId;
    team.eliminatedBy = req.user._id;
    team.eliminationReason = reason;

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team eliminated successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get leaderboard
// @route   GET /api/teams/hackathon/:hackathonId/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res) => {
  try {
    const { hackathonId } = req.params;
    const { roundId } = req.query;

    const query = { 
      hackathon: hackathonId,
      registrationStatus: 'approved',
      isEliminated: false
    };

    let teams = await Team.find(query)
      .populate('leader', 'fullName institution')
      .populate('members.user', 'fullName')
      .select('teamName teamNumber overallScore scores projectTitle')
      .sort({ overallScore: -1 });

    // Filter by round if specified
    if (roundId) {
      teams = teams.map(team => {
        const roundScore = team.getScoreForRound(roundId);
        return {
          ...team.toObject(),
          roundScore
        };
      }).sort((a, b) => b.roundScore - a.roundScore);
    }

    // Assign ranks
    teams = teams.map((team, index) => ({
      ...team,
      rank: index + 1
    }));

    res.status(200).json({
      success: true,
      count: teams.length,
      leaderboard: teams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my teams
// @route   GET /api/teams/my
// @access  Private
exports.getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { leader: req.user._id },
        { 'members.user': req.user._id, 'members.status': 'active' }
      ]
    })
      .populate('hackathon', 'title slug status hackathonStartDate hackathonEndDate')
      .populate('leader', 'fullName email')
      .populate('members.user', 'fullName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: teams.length,
      teams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Leave team
// @route   POST /api/teams/:teamId/leave
// @access  Private
exports.leaveTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is the leader
    if (team.leader.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Team leader cannot leave the team. Please transfer leadership first.'
      });
    }

    // Find the member
    const memberIndex = team.members.findIndex(
      m => m.user.toString() === req.user._id.toString() && m.status === 'active'
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of this team'
      });
    }

    // Mark member as left
    team.members[memberIndex].status = 'left';

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Successfully left the team',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove member from team
// @route   DELETE /api/teams/:teamId/members/:memberId
// @access  Private (Team Leader)
exports.removeMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team leader
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team leader can remove members'
      });
    }

    // Find the member
    const memberIndex = team.members.findIndex(
      m => m._id.toString() === memberId && m.status === 'active'
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in team'
      });
    }

    // Check if trying to remove leader
    if (team.members[memberIndex].role === 'leader') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove team leader'
      });
    }

    // Mark member as removed
    team.members[memberIndex].status = 'removed';

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get pending members (users with pending join requests)
// @route   GET /api/teams/:teamId/pending-members
// @access  Private (Team Leader)
exports.getPendingMembers = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is team leader
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team leader can view pending members'
      });
    }

    const pendingRequests = await JoinRequest.find({
      team: teamId,
      status: 'pending'
    })
      .populate('user', 'fullName username email roles institution')
      .populate('sender', 'fullName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pendingMembers: pendingRequests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel join request
// @route   DELETE /api/teams/:teamId/join-requests/:requestId
// @access  Private (Team Leader or Request Sender)
exports.cancelJoinRequest = async (req, res) => {
  try {
    const { teamId, requestId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const joinRequest = await JoinRequest.findById(requestId);

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Join request not found'
      });
    }

    // Check if user is team leader or the sender
    const isTeamLeader = team.leader.toString() === req.user._id.toString();
    const isSender = joinRequest.sender.toString() === req.user._id.toString();

    if (!isTeamLeader && !isSender) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this request'
      });
    }

    if (joinRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel pending requests'
      });
    }

    joinRequest.status = 'cancelled';
    joinRequest.respondedAt = new Date();
    await joinRequest.save();

    res.status(200).json({
      success: true,
      message: 'Join request cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;