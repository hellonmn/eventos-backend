const express = require('express');
const router = express.Router();
const {
  registerTeam,
  getTeamsByHackathon,
  getTeam,
  updateTeam,
  checkInTeam,
  checkInMember,
  assignTableAndTeamNumber,
  submitProject,
  scoreTeam,
  eliminateTeam,
  getLeaderboard,
  getMyTeams,
  getUserTeamForHackathon,
  searchUsersForTeam,
  sendJoinRequest,
  getJoinRequests,
  getMyJoinRequests,
  acceptJoinRequest,
  rejectJoinRequest,
  approveTeam,
  rejectTeam,
  leaveTeam,
  removeMember,
  getPendingMembers,
  cancelJoinRequest
} = require('../controllers/team.controller');
const { protect, isCoordinator, isJudge, checkCoordinatorPermission, authorize } = require('../middleware/auth');

// Student routes
router.post('/register', protect, registerTeam);
router.get('/my', protect, getMyTeams);
router.get('/my/hackathon/:hackathonId', protect, getUserTeamForHackathon);
router.get('/my/join-requests', protect, getMyJoinRequests);
router.get('/:id', protect, getTeam);
router.put('/:id', protect, updateTeam);
router.post('/:id/submit', protect, submitProject);

// Team join requests
router.get('/hackathon/:hackathonId/search-users', protect, searchUsersForTeam);
router.post('/:teamId/join-requests', protect, sendJoinRequest);
router.get('/:teamId/join-requests', protect, getJoinRequests);
router.get('/:teamId/pending-members', protect, getPendingMembers);
router.post('/:teamId/join-requests/:requestId/accept', protect, acceptJoinRequest);
router.post('/:teamId/join-requests/:requestId/reject', protect, rejectJoinRequest);
router.delete('/:teamId/join-requests/:requestId', protect, cancelJoinRequest);

// Team member management
router.post('/:teamId/leave', protect, leaveTeam);
router.delete('/:teamId/members/:memberId', protect, removeMember);

// Admin/Organizer routes
router.put('/:id/approve', protect, authorize(['admin', 'super_admin', 'organizer']), approveTeam);
router.put('/:id/reject', protect, authorize(['admin', 'super_admin', 'organizer']), rejectTeam);

// Coordinator routes
router.get('/hackathon/:hackathonId', protect, isCoordinator, getTeamsByHackathon);
router.post('/:id/checkin', protect, isCoordinator, checkCoordinatorPermission('canCheckIn'), checkInTeam);
router.post('/:id/members/:memberId/checkin', protect, isCoordinator, checkCoordinatorPermission('canCheckIn'), checkInMember);
router.put('/:id/assign', protect, isCoordinator, checkCoordinatorPermission('canAssignTables'), assignTableAndTeamNumber);
router.post('/:id/eliminate', protect, isCoordinator, checkCoordinatorPermission('canEliminateTeams'), eliminateTeam);

// Judge routes
router.post('/:id/score', protect, isJudge, scoreTeam);

// Public routes (leaderboard)
router.get('/hackathon/:hackathonId/leaderboard', getLeaderboard);

module.exports = router;