const { Payment, Subscription, SubscriptionPlan } = require('../models/Subscription');
const Team = require('../models/Team');
const Hackathon = require('../models/Hackathon');
const User = require('../models/User');
const razorpayService = require('../services/razorpay.service');
const emailService = require('../services/email.service');

// @desc    Create order for hackathon registration
// @route   POST /api/payments/hackathon/create-order
// @access  Private
exports.createHackathonOrder = async (req, res) => {
  try {
    const { teamId } = req.body;

    const team = await Team.findById(teamId).populate('hackathon');
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
        message: 'Only team members can make payment'
      });
    }

    // Check if already paid
    if (team.payment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed'
      });
    }

    const amount = team.payment.amount;
    const currency = team.payment.currency;
    const receipt = `HACK_${team.hackathon._id}_TEAM_${team._id}`;

    const orderResult = await razorpayService.createOrder(
      amount,
      currency,
      receipt,
      {
        hackathonId: team.hackathon._id.toString(),
        teamId: team._id.toString(),
        userId: req.user._id.toString()
      }
    );

    if (!orderResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order'
      });
    }

    // Create payment record
    const payment = await Payment.create({
      user: req.user._id,
      type: 'hackathon_registration',
      hackathon: team.hackathon._id,
      team: team._id,
      amount: amount,
      currency: currency,
      status: 'created',
      razorpayOrderId: orderResult.order.id
    });

    // Update team payment
    team.payment.razorpayOrderId = orderResult.order.id;
    await team.save();

    res.status(200).json({
      success: true,
      order: orderResult.order,
      payment,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Verify hackathon payment
// @route   POST /api/payments/hackathon/verify
// @access  Private
exports.verifyHackathonPayment = async (req, res) => {
  try {
    const { teamId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    const team = await Team.findById(teamId).populate('hackathon').populate('leader');
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Update team payment status
    team.payment.status = 'completed';
    team.payment.razorpayPaymentId = razorpayPaymentId;
    team.payment.razorpaySignature = razorpaySignature;
    team.payment.paidAt = new Date();
    team.payment.paidBy = req.user._id;

    // Auto-approve if setting is enabled
    if (team.hackathon.settings.autoAcceptTeams && team.registrationStatus === 'pending') {
      team.registrationStatus = 'approved';
      team.approvedAt = new Date();
    }

    await team.save();

    // Update payment record
    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        status: 'captured',
        razorpayPaymentId,
        razorpaySignature
      }
    );

    // Send confirmation email
    await emailService.sendPaymentConfirmation(
      req.user,
      {
        razorpayPaymentId,
        amount: team.payment.amount
      },
      team.hackathon
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all subscription plans
// @route   GET /api/payments/subscription-plans
// @access  Public
exports.getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, 'price.amount': 1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create subscription plan (Admin only)
// @route   POST /api/payments/subscription-plans
// @access  Private (Admin)
exports.createSubscriptionPlan = async (req, res) => {
  try {
    const { name, displayName, description, price, billingCycle, features } = req.body;

    // Create plan in Razorpay
    const period = billingCycle === 'monthly' ? 'monthly' : billingCycle === 'quarterly' ? 'monthly' : 'yearly';
    const interval = billingCycle === 'monthly' ? 1 : billingCycle === 'quarterly' ? 3 : 1;

    const razorpayPlanResult = await razorpayService.createSubscriptionPlan({
      name: displayName,
      description,
      amount: price.amount,
      currency: price.currency,
      period,
      interval,
      notes: { planName: name }
    });

    if (!razorpayPlanResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create plan in Razorpay'
      });
    }

    // Create plan in database
    const plan = await SubscriptionPlan.create({
      name,
      displayName,
      description,
      price,
      billingCycle,
      razorpayPlanId: razorpayPlanResult.plan.id,
      features
    });

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      plan
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Subscribe to a plan
// @route   POST /api/payments/subscribe
// @access  Private
exports.subscribe = async (req, res) => {
  try {
    const { planId } = req.body;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Check if user already has active subscription
    const existingSubscription = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ['active', 'authenticated', 'created'] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription'
      });
    }

    // Create or get customer in Razorpay
    let customerId = req.user.subscription?.razorpayCustomerId;
    
    if (!customerId) {
      const customerResult = await razorpayService.createCustomer({
        name: req.user.fullName,
        email: req.user.email,
        contact: req.user.phone,
        notes: { userId: req.user._id.toString() }
      });

      if (!customerResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create customer'
        });
      }

      customerId = customerResult.customer.id;
    }

    // Create subscription in Razorpay
    const totalCount = plan.billingCycle === 'monthly' ? 12 : plan.billingCycle === 'quarterly' ? 4 : 1;
    const subscriptionResult = await razorpayService.createSubscription(
      plan.razorpayPlanId,
      customerId,
      totalCount,
      {
        userId: req.user._id.toString(),
        planName: plan.name
      }
    );

    if (!subscriptionResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create subscription'
      });
    }

    // Create subscription record
    const subscription = await Subscription.create({
      user: req.user._id,
      plan: plan._id,
      status: subscriptionResult.subscription.status,
      razorpaySubscriptionId: subscriptionResult.subscription.id,
      razorpayCustomerId: customerId,
      razorpayPlanId: plan.razorpayPlanId,
      currentPeriodStart: new Date(subscriptionResult.subscription.start_at * 1000),
      currentPeriodEnd: new Date(subscriptionResult.subscription.end_at * 1000),
      totalCount: totalCount
    });

    // Update user subscription
    req.user.subscription.plan = plan.name;
    req.user.subscription.status = 'created';
    req.user.subscription.razorpaySubscriptionId = subscriptionResult.subscription.id;
    req.user.subscription.razorpayCustomerId = customerId;
    req.user.subscription.features = plan.features;
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription created successfully',
      subscription: subscriptionResult.subscription,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel subscription
// @route   POST /api/payments/subscription/cancel
// @access  Private
exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Cancel in Razorpay
    const cancelResult = await razorpayService.cancelSubscription(
      subscription.razorpaySubscriptionId,
      true // cancel at cycle end
    );

    if (!cancelResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription'
      });
    }

    // Update subscription
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    // Update user subscription
    req.user.subscription.status = 'cancelled';
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Handle Razorpay webhooks
// @route   POST /api/payments/webhook
// @access  Public (but verified)
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const payload = req.body;

    // Verify webhook signature
    const isValid = razorpayService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = payload.event;

    switch (event) {
      case 'subscription.activated':
        await handleSubscriptionActivated(payload.payload.subscription.entity);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload.payload.subscription.entity, payload.payload.payment.entity);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload.payload.subscription.entity);
        break;

      case 'subscription.paused':
        await handleSubscriptionPaused(payload.payload.subscription.entity);
        break;

      case 'subscription.resumed':
        await handleSubscriptionResumed(payload.payload.subscription.entity);
        break;

      case 'payment.captured':
        await handlePaymentCaptured(payload.payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payload.payment.entity);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper functions for webhook handlers
async function handleSubscriptionActivated(subscriptionData) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: subscriptionData.id
  }).populate('plan');

  if (subscription) {
    subscription.status = 'active';
    subscription.startedAt = new Date();
    await subscription.save();

    // Update user
    const user = await User.findById(subscription.user);
    user.subscription.status = 'active';
    user.subscription.startDate = new Date();
    await user.save();

    // Send confirmation email
    await emailService.sendSubscriptionConfirmation(user, subscription, subscription.plan);
  }
}

async function handleSubscriptionCharged(subscriptionData, paymentData) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: subscriptionData.id
  });

  if (subscription) {
    subscription.payments.push({
      razorpayPaymentId: paymentData.id,
      amount: paymentData.amount / 100,
      currency: paymentData.currency,
      status: 'captured',
      paidAt: new Date(paymentData.created_at * 1000)
    });
    subscription.paidCount += 1;
    await subscription.save();
  }
}

async function handleSubscriptionCancelled(subscriptionData) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: subscriptionData.id
  });

  if (subscription) {
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    // Update user
    const user = await User.findById(subscription.user);
    user.subscription.status = 'cancelled';
    await user.save();
  }
}

async function handleSubscriptionPaused(subscriptionData) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: subscriptionData.id
  });

  if (subscription) {
    subscription.status = 'paused';
    await subscription.save();

    const user = await User.findById(subscription.user);
    user.subscription.status = 'paused';
    await user.save();
  }
}

async function handleSubscriptionResumed(subscriptionData) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: subscriptionData.id
  });

  if (subscription) {
    subscription.status = 'active';
    await subscription.save();

    const user = await User.findById(subscription.user);
    user.subscription.status = 'active';
    await user.save();
  }
}

async function handlePaymentCaptured(paymentData) {
  await Payment.findOneAndUpdate(
    { razorpayPaymentId: paymentData.id },
    { status: 'captured' }
  );
}

async function handlePaymentFailed(paymentData) {
  await Payment.findOneAndUpdate(
    { razorpayPaymentId: paymentData.id },
    {
      status: 'failed',
      failureReason: paymentData.error_description
    }
  );
}

module.exports = exports;
