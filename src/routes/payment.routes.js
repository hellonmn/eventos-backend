const express = require('express');
const router = express.Router();
const {
  createHackathonOrder,
  verifyHackathonPayment,
  getSubscriptionPlans,
  createSubscriptionPlan,
  subscribe,
  cancelSubscription,
  handleWebhook
} = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth');

// Hackathon payment routes
router.post('/hackathon/create-order', protect, createHackathonOrder);
router.post('/hackathon/verify', protect, verifyHackathonPayment);

// Subscription routes
router.get('/subscription-plans', getSubscriptionPlans);
router.post('/subscription-plans', protect, authorize('admin', 'super_admin'), createSubscriptionPlan);
router.post('/subscribe', protect, subscribe);
router.post('/subscription/cancel', protect, cancelSubscription);

// Webhook
router.post('/webhook', handleWebhook);

module.exports = router;
