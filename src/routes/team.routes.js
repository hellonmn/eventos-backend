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
  getMyTeams
} = require('../controllers/team.controller');
const { protect, isCoordinator, isJudge, checkCoordinatorPermission } = require('../middleware/auth');

// Student routes
router.post('/register', protect, registerTeam);
router.get('/my', protect, getMyTeams);
router.get('/:id', protect, getTeam);
router.put('/:id', protect, updateTeam);
router.post('/:id/submit', protect, submitProject);

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
