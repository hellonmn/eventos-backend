const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hackathon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hackathon',
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  respondedAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      // Expire in 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true
});

// Indexes
joinRequestSchema.index({ team: 1, user: 1, status: 1 });
joinRequestSchema.index({ user: 1, status: 1 });
joinRequestSchema.index({ hackathon: 1, user: 1, status: 1 });
joinRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired requests

// Methods
joinRequestSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

module.exports = mongoose.model('JoinRequest', joinRequestSchema);