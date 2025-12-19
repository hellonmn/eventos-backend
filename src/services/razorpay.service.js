const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  // Create an order for hackathon registration
  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    try {
      const options = {
        amount: amount * 100, // Convert to paise
        currency: currency,
        receipt: receipt,
        notes: notes
      };

      const order = await this.razorpay.orders.create(options);
      return {
        success: true,
        order
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify payment signature
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const text = orderId + '|' + paymentId;
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      return generatedSignature === signature;
    } catch (error) {
      return false;
    }
  }

  // Create a subscription plan
  async createSubscriptionPlan(planData) {
    try {
      const options = {
        period: planData.period, // monthly, quarterly, yearly
        interval: planData.interval, // 1, 3, 12
        item: {
          name: planData.name,
          description: planData.description,
          amount: planData.amount * 100, // Convert to paise
          currency: planData.currency || 'INR'
        },
        notes: planData.notes || {}
      };

      const plan = await this.razorpay.plans.create(options);
      return {
        success: true,
        plan
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create a subscription
  async createSubscription(planId, customerId, totalCount, notes = {}) {
    try {
      const options = {
        plan_id: planId,
        customer_notify: 1,
        total_count: totalCount,
        notes: notes
      };

      if (customerId) {
        options.customer_id = customerId;
      }

      const subscription = await this.razorpay.subscriptions.create(options);
      return {
        success: true,
        subscription
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create a customer
  async createCustomer(customerData) {
    try {
      const options = {
        name: customerData.name,
        email: customerData.email,
        contact: customerData.contact,
        fail_existing: 0,
        notes: customerData.notes || {}
      };

      const customer = await this.razorpay.customers.create(options);
      return {
        success: true,
        customer
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Fetch subscription details
  async fetchSubscription(subscriptionId) {
    try {
      const subscription = await this.razorpay.subscriptions.fetch(subscriptionId);
      return {
        success: true,
        subscription
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId, cancelAtCycleEnd = false) {
    try {
      const subscription = await this.razorpay.subscriptions.cancel(
        subscriptionId,
        cancelAtCycleEnd
      );
      return {
        success: true,
        subscription
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Pause a subscription
  async pauseSubscription(subscriptionId, pauseAt = 'now') {
    try {
      const subscription = await this.razorpay.subscriptions.pause(
        subscriptionId,
        { pause_at: pauseAt }
      );
      return {
        success: true,
        subscription
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Resume a subscription
  async resumeSubscription(subscriptionId, resumeAt = 'now') {
    try {
      const subscription = await this.razorpay.subscriptions.resume(
        subscriptionId,
        { resume_at: resumeAt }
      );
      return {
        success: true,
        subscription
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Fetch payment details
  async fetchPayment(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        payment
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Capture payment
  async capturePayment(paymentId, amount, currency = 'INR') {
    try {
      const payment = await this.razorpay.payments.capture(
        paymentId,
        amount * 100,
        currency
      );
      return {
        success: true,
        payment
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Refund payment
  async refundPayment(paymentId, amount, notes = {}) {
    try {
      const options = {
        amount: amount * 100,
        notes: notes
      };

      const refund = await this.razorpay.payments.refund(paymentId, options);
      return {
        success: true,
        refund
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      return false;
    }
  }

  // Generate payment link
  async createPaymentLink(amount, description, customer, notes = {}) {
    try {
      const options = {
        amount: amount * 100,
        currency: 'INR',
        description: description,
        customer: {
          name: customer.name,
          email: customer.email,
          contact: customer.contact
        },
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        notes: notes,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        callback_method: 'get'
      };

      const paymentLink = await this.razorpay.paymentLink.create(options);
      return {
        success: true,
        paymentLink
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new RazorpayService();
