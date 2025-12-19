const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: String,
  price: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true
  },
  razorpayPlanId: {
    type: String,
    required: true,
    unique: true
  },
  features: {
    maxHackathons: {
      type: Number,
      required: true
    },
    maxTeamMembers: {
      type: Number,
      required: true
    },
    canCreateHackathons: {
      type: Boolean,
      default: false
    },
    canInviteJudges: {
      type: Boolean,
      default: false
    },
    analytics: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    removeWatermark: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  status: {
    type: String,
    enum: ['created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired'],
    default: 'created'
  },
  razorpaySubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayCustomerId: String,
  razorpayPlanId: String,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextBillingDate: Date,
  startedAt: Date,
  cancelledAt: Date,
  completedAt: Date,
  paidCount: {
    type: Number,
    default: 0
  },
  remainingCount: Number,
  totalCount: Number,
  payments: [{
    razorpayPaymentId: String,
    amount: Number,
    currency: String,
    status: {
      type: String,
      enum: ['authorized', 'captured', 'failed', 'refunded']
    },
    paidAt: Date,
    failureReason: String
  }],
  notes: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['hackathon_registration', 'subscription', 'upgrade', 'other'],
    required: true
  },
  hackathon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hackathon'
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'refund_pending', 'refunded', 'failed'],
    default: 'created'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  paymentMethod: String,
  paymentEmail: String,
  paymentContact: String,
  failureReason: String,
  refundId: String,
  refundAmount: Number,
  refundedAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
  notes: String
}, {
  timestamps: true
});

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ team: 1 });

// Methods for Subscription
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active';
};

subscriptionSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  return await this.save();
};

// Methods for SubscriptionPlan
subscriptionPlanSchema.methods.getPricePerMonth = function() {
  switch(this.billingCycle) {
    case 'monthly':
      return this.price.amount;
    case 'quarterly':
      return this.price.amount / 3;
    case 'yearly':
      return this.price.amount / 12;
    default:
      return this.price.amount;
  }
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = {
  SubscriptionPlan,
  Subscription,
  Payment
};
