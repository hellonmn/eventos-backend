const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['leader', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'left', 'removed'],
    default: 'active'
  },
  checkIn: {
    isCheckedIn: {
      type: Boolean,
      default: false
    },
    checkedInAt: Date,
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
});

const teamSchema = new mongoose.Schema({
  hackathon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hackathon',
    required: true
  },
  teamName: {
    type: String,
    required: true,
    trim: true
  },
  teamNumber: {
    type: String,
    trim: true
  },
  tableNumber: {
    type: String,
    trim: true
  },
  members: [teamMemberSchema],
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectTitle: {
    type: String,
    trim: true
  },
  projectDescription: {
    type: String
  },
  projectCategory: {
    type: String
  },
  techStack: [String],
  
  // Registration
  registrationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Payment
  payment: {
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    amount: Number,
    currency: {
      type: String,
      default: 'INR'
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paidAt: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Submissions per round
  submissions: [{
    round: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    submittedAt: Date,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    projectLink: String,
    demoLink: String,
    videoLink: String,
    presentationLink: String,
    githubRepo: String,
    files: [{
      name: String,
      url: String,
      type: String,
      size: Number
    }],
    description: String,
    techStack: [String],
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'reviewed', 'selected', 'rejected'],
      default: 'submitted'
    }
  }],
  
  // Scoring per round
  scores: [{
    round: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    judge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    criteriaScores: [{
      criteriaName: String,
      score: Number,
      maxScore: Number
    }],
    totalScore: Number,
    maxPossibleScore: Number,
    remarks: String,
    feedback: String,
    submittedAt: {
      type: Date,
      default: Date.now
    },
    isFinalized: {
      type: Boolean,
      default: false
    }
  }],
  
  // Overall performance
  overallScore: {
    type: Number,
    default: 0
  },
  rank: Number,
  
  // Elimination status
  isEliminated: {
    type: Boolean,
    default: false
  },
  eliminatedAt: Date,
  eliminatedInRound: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hackathon.rounds'
  },
  eliminatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  eliminationReason: String,
  
  // Prize
  prize: {
    position: String,
    title: String,
    amount: Number,
    awarded: {
      type: Boolean,
      default: false
    }
  },
  
  // Check-in
  checkIn: {
    isCheckedIn: {
      type: Boolean,
      default: false
    },
    checkedInAt: Date,
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    allMembersCheckedIn: {
      type: Boolean,
      default: false
    }
  },
  
  // Communication
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    isPublic: {
      type: Boolean,
      default: false
    }
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
teamSchema.index({ hackathon: 1, teamName: 1 }, { unique: true });
teamSchema.index({ hackathon: 1, leader: 1 });
teamSchema.index({ 'members.user': 1 });

// Methods
teamSchema.methods.isMember = function(userId) {
  return this.members.some(
    m => m.user.toString() === userId.toString() && m.status === 'active'
  );
};

teamSchema.methods.isLeader = function(userId) {
  return this.leader.toString() === userId.toString();
};

teamSchema.methods.getActiveMembers = function() {
  return this.members.filter(m => m.status === 'active');
};

teamSchema.methods.calculateOverallScore = function() {
  if (this.scores.length === 0) return 0;
  
  const totalScore = this.scores.reduce((sum, score) => {
    return score.isFinalized ? sum + score.totalScore : sum;
  }, 0);
  
  const totalPossible = this.scores.reduce((sum, score) => {
    return score.isFinalized ? sum + score.maxPossibleScore : sum;
  }, 0);
  
  return totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
};

teamSchema.methods.hasSubmittedForRound = function(roundId) {
  return this.submissions.some(
    s => s.round.toString() === roundId.toString()
  );
};

teamSchema.methods.getScoreForRound = function(roundId) {
  const roundScores = this.scores.filter(
    s => s.round.toString() === roundId.toString() && s.isFinalized
  );
  
  if (roundScores.length === 0) return 0;
  
  const totalScore = roundScores.reduce((sum, score) => sum + score.totalScore, 0);
  return totalScore / roundScores.length;
};

// Pre-save hook to update overall score
teamSchema.pre('save', function(next) {
  this.overallScore = this.calculateOverallScore();
  next();
});

module.exports = mongoose.model('Team', teamSchema);
