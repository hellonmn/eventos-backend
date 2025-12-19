const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  roles: [{
    type: String,
    enum: ['student', 'coordinator', 'judge', 'admin', 'super_admin'],
    default: ['student']
  }],
  phone: {
    type: String,
    trim: true
  },
  institution: {
    type: String,
    trim: true
  },
  profile: {
    avatar: String,
    bio: String,
    skills: [String],
    github: String,
    linkedin: String,
    portfolio: String
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'cancelled'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    razorpaySubscriptionId: String,
    razorpayCustomerId: String,
    features: {
      maxHackathons: { type: Number, default: 1 },
      maxTeamMembers: { type: Number, default: 4 },
      canCreateHackathons: { type: Boolean, default: false },
      canInviteJudges: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false }
    }
  },
  coordinatorFor: [{
    hackathon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hackathon'
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
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: Date,
    acceptedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  }],
  judgeFor: [{
    hackathon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hackathon'
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: Date,
    acceptedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  }],
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has role
userSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

// Check if user has any of the roles
userSchema.methods.hasAnyRole = function(roles) {
  return roles.some(role => this.roles.includes(role));
};

// Check if user is coordinator for a hackathon
userSchema.methods.isCoordinatorFor = function(hackathonId) {
  return this.coordinatorFor.some(
    coord => coord.hackathon.toString() === hackathonId.toString() && 
    coord.status === 'accepted'
  );
};

// Check if user is judge for a hackathon
userSchema.methods.isJudgeFor = function(hackathonId) {
  return this.judgeFor.some(
    judge => judge.hackathon.toString() === hackathonId.toString() && 
    judge.status === 'accepted'
  );
};

// Get coordinator permissions for a hackathon
userSchema.methods.getCoordinatorPermissions = function(hackathonId) {
  const coord = this.coordinatorFor.find(
    c => c.hackathon.toString() === hackathonId.toString() && 
    c.status === 'accepted'
  );
  return coord ? coord.permissions : null;
};

module.exports = mongoose.model('User', userSchema);
