// seed file for subscription
require('dotenv').config();
const mongoose = require('mongoose');
const { SubscriptionPlan } = require('./src/models/Subscription');
const razorpayService = require('./src/services/razorpay.service');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const seedPlans = async () => {
  try {
    await connectDB();

    // Clear existing plans
    await SubscriptionPlan.deleteMany({});
    console.log('Cleared existing subscription plans');

    const plans = [
      {
        name: 'free',
        displayName: 'Free Plan',
        description: 'Perfect for getting started',
        price: {
          amount: 0,
          currency: 'INR'
        },
        billingCycle: 'monthly',
        features: {
          maxHackathons: 1,
          maxTeamMembers: 4,
          canCreateHackathons: false,
          canInviteJudges: false,
          analytics: false,
          customBranding: false,
          prioritySupport: false,
          removeWatermark: false
        },
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'basic',
        displayName: 'Basic Plan',
        description: 'For small hackathon organizers',
        price: {
          amount: 499,
          currency: 'INR'
        },
        billingCycle: 'monthly',
        features: {
          maxHackathons: 3,
          maxTeamMembers: 6,
          canCreateHackathons: true,
          canInviteJudges: true,
          analytics: false,
          customBranding: false,
          prioritySupport: false,
          removeWatermark: false
        },
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'premium',
        displayName: 'Premium Plan',
        description: 'Most popular for regular organizers',
        price: {
          amount: 999,
          currency: 'INR'
        },
        billingCycle: 'monthly',
        features: {
          maxHackathons: 10,
          maxTeamMembers: 10,
          canCreateHackathons: true,
          canInviteJudges: true,
          analytics: true,
          customBranding: true,
          prioritySupport: true,
          removeWatermark: true
        },
        isActive: true,
        sortOrder: 3
      },
      {
        name: 'enterprise',
        displayName: 'Enterprise Plan',
        description: 'For large organizations and institutions',
        price: {
          amount: 2499,
          currency: 'INR'
        },
        billingCycle: 'monthly',
        features: {
          maxHackathons: 999,
          maxTeamMembers: 20,
          canCreateHackathons: true,
          canInviteJudges: true,
          analytics: true,
          customBranding: true,
          prioritySupport: true,
          removeWatermark: true
        },
        isActive: true,
        sortOrder: 4
      }
    ];

    // Create plans (skip Razorpay creation for free plan)
    for (const planData of plans) {
      let razorpayPlanId = 'free_plan';

      if (planData.name !== 'free') {
        // Create plan in Razorpay
        const razorpayPlan = await razorpayService.createSubscriptionPlan({
          name: planData.displayName,
          description: planData.description,
          amount: planData.price.amount,
          currency: planData.price.currency,
          period: planData.billingCycle === 'monthly' ? 'monthly' : 'yearly',
          interval: 1,
          notes: { planName: planData.name }
        });

        if (!razorpayPlan.success) {
          console.error(`Failed to create ${planData.name} in Razorpay:`, razorpayPlan.error);
          continue;
        }

        razorpayPlanId = razorpayPlan.plan.id;
      }

      // Create plan in database
      const plan = await SubscriptionPlan.create({
        ...planData,
        razorpayPlanId
      });

      console.log(`✓ Created ${plan.displayName} (${plan.name})`);
    }

    console.log('\n✓ All subscription plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding plans:', error);
    process.exit(1);
  }
};

// Run the seed function
seedPlans();
