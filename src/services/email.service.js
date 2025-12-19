const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `${options.fromName || 'Hackathon Platform'} <${process.env.EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      };

      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send coordinator invitation
  async sendCoordinatorInvitation(user, hackathon, invitedBy, token) {
    const acceptUrl = `${process.env.FRONTEND_URL}/coordinator/accept/${token}`;
    const declineUrl = `${process.env.FRONTEND_URL}/coordinator/decline/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .accept-btn { background: #10B981; color: white; }
          .decline-btn { background: #EF4444; color: white; }
          .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4F46E5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Coordinator Invitation</h1>
          </div>
          <div class="content">
            <p>Hello ${user.fullName},</p>
            
            <p><strong>${invitedBy.fullName}</strong> has invited you to be a coordinator for the hackathon:</p>
            
            <div class="details">
              <h2>${hackathon.title}</h2>
              <p>${hackathon.description}</p>
              <p><strong>Duration:</strong> ${new Date(hackathon.hackathonStartDate).toLocaleDateString()} - ${new Date(hackathon.hackathonEndDate).toLocaleDateString()}</p>
            </div>

            <p>As a coordinator, you will be able to:</p>
            <ul>
              <li>View and manage registered teams</li>
              <li>Check-in participants</li>
              <li>Assign table numbers to teams</li>
              <li>View submissions</li>
              <li>Communicate with participants</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" class="button accept-btn">Accept Invitation</a>
              <a href="${declineUrl}" class="button decline-btn">Decline</a>
            </div>

            <p>If you have any questions, please contact the organizer at ${hackathon.contactEmail || invitedBy.email}.</p>
            
            <p>Best regards,<br>Hackathon Platform Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: user.email,
      subject: `Coordinator Invitation: ${hackathon.title}`,
      html: html
    });
  }

  // Send judge invitation
  async sendJudgeInvitation(user, hackathon, invitedBy, token) {
    const acceptUrl = `${process.env.FRONTEND_URL}/judge/accept/${token}`;
    const declineUrl = `${process.env.FRONTEND_URL}/judge/decline/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7C3AED; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .accept-btn { background: #10B981; color: white; }
          .decline-btn { background: #EF4444; color: white; }
          .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #7C3AED; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Judge Invitation</h1>
          </div>
          <div class="content">
            <p>Hello ${user.fullName},</p>
            
            <p><strong>${invitedBy.fullName}</strong> has invited you to be a judge for the hackathon:</p>
            
            <div class="details">
              <h2>${hackathon.title}</h2>
              <p>${hackathon.description}</p>
              <p><strong>Duration:</strong> ${new Date(hackathon.hackathonStartDate).toLocaleDateString()} - ${new Date(hackathon.hackathonEndDate).toLocaleDateString()}</p>
            </div>

            <p>As a judge, you will be able to:</p>
            <ul>
              <li>Access team submissions</li>
              <li>Score teams based on judging criteria</li>
              <li>Provide feedback and remarks</li>
              <li>View the leaderboard</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" class="button accept-btn">Accept Invitation</a>
              <a href="${declineUrl}" class="button decline-btn">Decline</a>
            </div>

            <p>If you have any questions, please contact the organizer at ${hackathon.contactEmail || invitedBy.email}.</p>
            
            <p>Best regards,<br>Hackathon Platform Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: user.email,
      subject: `Judge Invitation: ${hackathon.title}`,
      html: html
    });
  }

  // Send team registration confirmation
  async sendTeamRegistrationConfirmation(team, hackathon) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Registration Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hello ${team.teamName} Team,</p>
            
            <p>Your team has been successfully registered for:</p>
            
            <div class="details">
              <h2>${hackathon.title}</h2>
              <p><strong>Team Name:</strong> ${team.teamName}</p>
              <p><strong>Team Members:</strong> ${team.members.length}</p>
              <p><strong>Hackathon Start:</strong> ${new Date(hackathon.hackathonStartDate).toLocaleDateString()}</p>
            </div>

            <p>Next steps:</p>
            <ul>
              <li>Check your dashboard for hackathon updates</li>
              <li>Prepare your project idea</li>
              <li>Review the hackathon rules and guidelines</li>
              <li>Join the hackathon community channels</li>
            </ul>

            <p>We're excited to see what you build!</p>
            
            <p>Best regards,<br>Hackathon Platform Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to team leader
    return await this.sendEmail({
      to: team.leader.email,
      subject: `Registration Confirmed: ${hackathon.title}`,
      html: html
    });
  }

  // Send payment confirmation
  async sendPaymentConfirmation(user, payment, hackathon) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10B981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful</h1>
          </div>
          <div class="content">
            <p>Hello ${user.fullName},</p>
            
            <p>Your payment has been successfully processed.</p>
            
            <div class="details">
              <p><strong>Payment ID:</strong> ${payment.razorpayPaymentId}</p>
              <p><strong>Amount:</strong> ₹${payment.amount}</p>
              <p><strong>Hackathon:</strong> ${hackathon.title}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p>You're all set for the hackathon! We look forward to seeing you there.</p>
            
            <p>Best regards,<br>Hackathon Platform Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: user.email,
      subject: `Payment Confirmation: ${hackathon.title}`,
      html: html
    });
  }

  // Send subscription confirmation
  async sendSubscriptionConfirmation(user, subscription, plan) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4F46E5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Activated!</h1>
          </div>
          <div class="content">
            <p>Hello ${user.fullName},</p>
            
            <p>Your ${plan.displayName} subscription has been successfully activated.</p>
            
            <div class="details">
              <p><strong>Plan:</strong> ${plan.displayName}</p>
              <p><strong>Billing Cycle:</strong> ${plan.billingCycle}</p>
              <p><strong>Next Billing Date:</strong> ${new Date(subscription.nextBillingDate).toLocaleDateString()}</p>
            </div>

            <p>You now have access to:</p>
            <ul>
              ${plan.features.canCreateHackathons ? '<li>Create hackathons</li>' : ''}
              ${plan.features.analytics ? '<li>Advanced analytics</li>' : ''}
              ${plan.features.customBranding ? '<li>Custom branding</li>' : ''}
              ${plan.features.prioritySupport ? '<li>Priority support</li>' : ''}
            </ul>

            <p>Thank you for subscribing!</p>
            
            <p>Best regards,<br>Hackathon Platform Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Subscription Activated - Hackathon Platform',
      html: html
    });
  }
}

module.exports = new EmailService();
