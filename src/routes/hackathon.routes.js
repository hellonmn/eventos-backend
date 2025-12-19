const express = require('express');
const router = express.Router();
const {
  createHackathon,
  getHackathons,
  getHackathon,
  updateHackathon,
  deleteHackathon,
  getMyHackathons,
  getMyCoordinations,
  inviteCoordinator,
  acceptCoordinatorInvitation,
  updateCoordinatorPermissions,
  inviteJudge,
  acceptJudgeInvitation
} = require('../controllers/hackathon.controller');
const { protect, authorize, isOrganizer } = require('../middleware/auth');

// Public routes
router.get('/', getHackathons);
router.get('/:id', getHackathon);

// Protected routes
router.post('/', protect, createHackathon);
router.get('/my/organized', protect, getMyHackathons);
router.get('/my/coordinations', protect, getMyCoordinations);

// Organizer routes
router.put('/:id', protect, isOrganizer, updateHackathon);
router.delete('/:id', protect, isOrganizer, deleteHackathon);

// Coordinator management
router.post('/:id/coordinators/invite', protect, isOrganizer, inviteCoordinator);
router.post('/coordinators/accept/:token', protect, acceptCoordinatorInvitation);
router.put('/:id/coordinators/:userId/permissions', protect, isOrganizer, updateCoordinatorPermissions);

// Judge management
router.post('/:id/judges/invite', protect, isOrganizer, inviteJudge);
router.post('/judges/accept/:token', protect, acceptJudgeInvitation);

module.exports = router;
