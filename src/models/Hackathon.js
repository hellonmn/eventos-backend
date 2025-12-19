const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['submission', 'presentation', 'interview', 'workshop', 'other'],
    required: true
  },
  mode: {
    type: String,
    enum: ['online', 'offline'],
    required: true
  },
  description: String,
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  maxScore: {
    type: Number,
    default: 100
  },
  judgingCriteria: [{
    name: String,
    description: String,
    maxPoints: Number
  }],
  eliminationCount: {
    type: Number,
    default: 0
  },
  isEliminationRound: {
    type: Boolean,
    default: false
  },
  location: String, // For offline rounds
  meetingLink: String, // For online rounds
  instructions: String,
  order: Number
});

const scheduleEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['opening', 'closing', 'workshop', 'mentoring', 'break', 'meal', 'networking', 'other'],
    default: 'other'
  },
  location: String,
  meetingLink: String,
  isPublic: {
    type: Boolean,
    default: true
  }
});

const hackathonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Hackathon title is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizerDetails: {
    name: String,
    email: String,
    phone: String,
    organization: String
  },
  theme: String,
  tags: [String],
  banner: String,
  logo: String,
  
  // Date and Duration
  registrationStartDate: {
    type: Date,
    required: true
  },
  registrationEndDate: {
    type: Date,
    required: true
  },
  hackathonStartDate: {
    type: Date,
    required: true
  },
  hackathonEndDate: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  
  // Team Configuration
  teamConfig: {
    minMembers: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    maxMembers: {
      type: Number,
      required: true,
      min: 1,
      default: 4
    },
    allowSoloParticipation: {
      type: Boolean,
      default: true
    }
  },
  
  // Registration
  maxTeams: {
    type: Number,
    default: 100
  },
  currentRegistrations: {
    type: Number,
    default: 0
  },
  registrationFee: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    razorpayPlanId: String
  },
  
  // Payment Options
  paymentOptions: {
    perTeam: {
      enabled: {
        type: Boolean,
        default: true
      },
      amount: Number
    },
    perParticipant: {
      enabled: {
        type: Boolean,
        default: false
      },
      amount: Number
    },
    earlyBirdDiscount: {
      enabled: {
        type: Boolean,
        default: false
      },
      discountPercent: Number,
      validUntil: Date
    }
  },
  
  // Rounds
  rounds: [roundSchema],
  
  // Schedule
  schedule: [scheduleEventSchema],
  
  // Prizes
  prizes: [{
    position: String,
    title: String,
    amount: Number,
    description: String,
    sponsor: String
  }],
  
  // Eligibility
  eligibility: {
    allowedInstitutions: [String],
    allowedDomains: [String], // Email domains
    minAge: Number,
    maxAge: Number,
    requiredSkills: [String],
    customCriteria: String
  },
  
  // Rules and Guidelines
  rules: [String],
  guidelines: String,
  judgingCriteria: String,
  submissionGuidelines: String,
  
  // Sponsors
  sponsors: [{
    name: String,
    logo: String,
    website: String,
    tier: {
      type: String,
      enum: ['title', 'platinum', 'gold', 'silver', 'bronze', 'partner']
    }
  }],
  
  // Mentors
  mentors: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    bio: String,
    expertise: [String],
    photo: String
  }],
  
  // Coordinators
  coordinators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: {
      canViewTeams: { type: Boolean, default: true },
      canEditTeams: { type: Boolean, default: false },
      canCheckIn: { type: Boolean, default: true },
      canAssignTables: { type: Boolean, default: true },
      canViewSubmissions: { type: Boolean, default: true },
      canEliminateTeams: { type: Boolean, default: false },
      canCommunicate: { type: Boolean, default: true }
    },
    addedAt: Date
  }],
  
  // Judges
  judges: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    bio: String,
    photo: String,
    expertise: [String],
    assignedRounds: [mongoose.Schema.Types.ObjectId]
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Visibility
  isPublic: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Location
  mode: {
    type: String,
    enum: ['online', 'offline', 'hybrid'],
    required: true
  },
  venue: {
    name: String,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    mapLink: String
  },
  
  // Resources
  resources: [{
    title: String,
    description: String,
    link: String,
    type: {
      type: String,
      enum: ['document', 'video', 'link', 'dataset', 'api']
    }
  }],
  
  // Social Links
  socialLinks: {
    website: String,
    discord: String,
    slack: String,
    telegram: String,
    twitter: String,
    linkedin: String,
    instagram: String
  },
  
  // Contact
  contactEmail: String,
  contactPhone: String,
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  
  // Settings
  settings: {
    allowTeamNameChange: {
      type: Boolean,
      default: true
    },
    allowTeamMemberChange: {
      type: Boolean,
      default: true
    },
    allowLateRegistration: {
      type: Boolean,
      default: false
    },
    requirePaymentConfirmation: {
      type: Boolean,
      default: true
    },
    autoAcceptTeams: {
      type: Boolean,
      default: true
    },
    enableCheckIn: {
      type: Boolean,
      default: true
    },
    enableLeaderboard: {
      type: Boolean,
      default: true
    },
    showJudgesPublicly: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Generate slug from title
hackathonSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now();
  }
  next();
});

// Methods
hackathonSchema.methods.isRegistrationOpen = function() {
  const now = new Date();
  return now >= this.registrationStartDate && 
         now <= this.registrationEndDate && 
         this.status === 'registration_open' &&
         this.currentRegistrations < this.maxTeams;
};

hackathonSchema.methods.isOngoing = function() {
  const now = new Date();
  return now >= this.hackathonStartDate && 
         now <= this.hackathonEndDate && 
         this.status === 'ongoing';
};

hackathonSchema.methods.hasUserRole = function(userId, role) {
  if (role === 'organizer') {
    return this.organizer.toString() === userId.toString();
  }
  if (role === 'coordinator') {
    return this.coordinators.some(c => c.user.toString() === userId.toString());
  }
  if (role === 'judge') {
    return this.judges.some(j => j.user.toString() === userId.toString());
  }
  return false;
};

module.exports = mongoose.model('Hackathon', hackathonSchema);
