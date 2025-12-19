const Team = require('../models/Team');
const Hackathon = require('../models/Hackathon');
const User = require('../models/User');
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
    await emailService.sendTeamRegistrationConfirmation(
      { teamName, members: teamMembers, leader: req.user },
      hackathon
    );

    res.status(201).json({
      success: true,
      message: 'Team registered successfully',
      team,
      requiresPayment: hackathon.registrationFee.amount > 0
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

module.exports = exports;
