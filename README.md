# Hackathon Management Platform - Backend

A comprehensive backend system for managing hackathons with role-based access control, subscription management via Razorpay, and features for organizers, coordinators, judges, and participants.

## Features

### Core Features
- **Multi-role System**: Admin, Super Admin, Judge, Coordinator, Student
- **Hackathon Management**: Create, update, and manage hackathons with detailed configurations
- **Team Registration**: Teams can register with configurable size limits
- **Multiple Rounds**: Support for submission rounds, presentation rounds, elimination rounds
- **Payment Integration**: Razorpay integration for registration fees and subscriptions
- **Subscription Plans**: Tiered subscription system with customizable features
- **Coordinator System**: Invite coordinators with granular permissions
- **Judge Portal**: Invite judges to score teams with custom criteria
- **Check-in System**: Track participant attendance
- **Leaderboard**: Real-time scoring and rankings
- **Email Notifications**: Automated emails for invitations, registrations, and payments

### Role-Specific Features

#### Organizer
- Create and manage hackathons
- Set team size limits, registration fees, and payment options
- Create multiple rounds (online/offline, submission/presentation)
- Invite and manage coordinators and judges
- View all teams and submissions
- Assign table numbers and team numbers
- Eliminate teams based on rounds
- View analytics and reports

#### Coordinator
- Cannot participate in hackathons they coordinate
- View registered teams (if permission granted)
- Check-in participants
- Assign table and team numbers (if permission granted)
- View submissions (if permission granted)
- Communicate with teams
- Permissions fully editable by organizer

#### Judge
- Access assigned hackathons
- View team submissions
- Score teams based on judging criteria
- Provide feedback and remarks
- View leaderboard

#### Student/Participant
- Register teams for hackathons
- View "My Coordinations" if invited as coordinator
- Cannot be both participant and coordinator in same hackathon
- Submit projects for rounds
- Track team progress
- View leaderboard

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Payment Gateway**: Razorpay
- **Email Service**: Nodemailer
- **Security**: Helmet, bcryptjs, express-rate-limit

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Razorpay account

### Setup

1. Clone the repository
```bash
git clone <repository-url>
cd hackathon-backend
```

2. Install dependencies
```bash
npm install
```

3. Create environment file
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/hackathon_platform

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@hackathonplatform.com

# Frontend
FRONTEND_URL=http://localhost:3000
```

5. Start the server
```bash
# Development
npm run dev

# Production
npm start
```

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "institution": "MIT"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Hackathon Endpoints

#### Create Hackathon
```http
POST /api/hackathons
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "AI Innovation Challenge",
  "description": "Build innovative AI solutions",
  "registrationStartDate": "2025-01-01T00:00:00Z",
  "registrationEndDate": "2025-01-31T23:59:59Z",
  "hackathonStartDate": "2025-02-01T00:00:00Z",
  "hackathonEndDate": "2025-02-03T23:59:59Z",
  "teamConfig": {
    "minMembers": 1,
    "maxMembers": 4
  },
  "mode": "hybrid",
  "registrationFee": {
    "amount": 500,
    "currency": "INR"
  },
  "rounds": [
    {
      "name": "Submission Round",
      "type": "submission",
      "mode": "online",
      "startTime": "2025-02-01T00:00:00Z",
      "endTime": "2025-02-02T23:59:59Z",
      "maxScore": 100
    }
  ]
}
```

#### Get All Hackathons
```http
GET /api/hackathons?status=registration_open&page=1&limit=10
```

#### Get My Coordinations
```http
GET /api/hackathons/my/coordinations
Authorization: Bearer <token>
```

#### Invite Coordinator
```http
POST /api/hackathons/:id/coordinators/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "emailOrUsername": "coordinator@example.com",
  "permissions": {
    "canViewTeams": true,
    "canCheckIn": true,
    "canAssignTables": true,
    "canEliminateTeams": false
  }
}
```

#### Update Coordinator Permissions
```http
PUT /api/hackathons/:id/coordinators/:userId/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "permissions": {
    "canEliminateTeams": true
  }
}
```

### Team Endpoints

#### Register Team
```http
POST /api/teams/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "hackathonId": "hackathon_id",
  "teamName": "Team Alpha",
  "members": ["user_id_1", "user_id_2"],
  "projectTitle": "AI Healthcare Solution",
  "projectDescription": "An AI system for healthcare diagnostics"
}
```

#### Get Teams (Coordinator)
```http
GET /api/teams/hackathon/:hackathonId?status=approved&page=1
Authorization: Bearer <token>
```

#### Check-in Team
```http
POST /api/teams/:id/checkin
Authorization: Bearer <token>
```

#### Assign Table Number
```http
PUT /api/teams/:id/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "tableNumber": "T-12",
  "teamNumber": "TEAM-042"
}
```

#### Submit Project
```http
POST /api/teams/:id/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "roundId": "round_id",
  "projectLink": "https://project.com",
  "githubRepo": "https://github.com/user/repo",
  "demoLink": "https://demo.com",
  "description": "Project description",
  "techStack": ["React", "Node.js", "MongoDB"]
}
```

#### Score Team (Judge)
```http
POST /api/teams/:id/score
Authorization: Bearer <token>
Content-Type: application/json

{
  "roundId": "round_id",
  "criteriaScores": [
    {
      "criteriaName": "Innovation",
      "score": 45,
      "maxScore": 50
    },
    {
      "criteriaName": "Technical Implementation",
      "score": 40,
      "maxScore": 50
    }
  ],
  "remarks": "Great project!",
  "feedback": "Excellent implementation with room for improvement in UI"
}
```

#### Eliminate Team
```http
POST /api/teams/:id/eliminate
Authorization: Bearer <token>
Content-Type: application/json

{
  "roundId": "round_id",
  "reason": "Did not meet minimum criteria"
}
```

#### Get Leaderboard
```http
GET /api/teams/hackathon/:hackathonId/leaderboard?roundId=round_id
```

### Payment Endpoints

#### Get Subscription Plans
```http
GET /api/payments/subscription-plans
```

#### Create Payment Order
```http
POST /api/payments/hackathon/create-order
Authorization: Bearer <token>
Content-Type: application/json

{
  "teamId": "team_id"
}
```

#### Verify Payment
```http
POST /api/payments/hackathon/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "teamId": "team_id",
  "razorpayOrderId": "order_id",
  "razorpayPaymentId": "payment_id",
  "razorpaySignature": "signature"
}
```

#### Subscribe
```http
POST /api/payments/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "plan_id"
}
```

## Database Models

### User Model
- Basic info: username, email, password, fullName
- Roles: student, coordinator, judge, admin, super_admin
- Subscription details with Razorpay integration
- Coordinator invitations with permissions
- Judge invitations

### Hackathon Model
- Complete hackathon configuration
- Team size constraints (min/max members)
- Multiple rounds with elimination support
- Payment options (per team/per participant)
- Schedule management
- Coordinator and judge lists
- Settings for auto-approval, check-in, etc.

### Team Model
- Team members with roles
- Payment status tracking
- Submissions per round
- Scoring by judges
- Check-in status
- Table and team numbers
- Elimination tracking

### Subscription Models
- SubscriptionPlan: Feature definitions
- Subscription: User subscription tracking
- Payment: Transaction records

## Role-Based Access Control

### Permission Levels
1. **Super Admin**: Full system access
2. **Admin**: Manage all hackathons and users
3. **Organizer**: Manage own hackathons
4. **Coordinator**: Limited hackathon management (permission-based)
5. **Judge**: Score teams in assigned hackathons
6. **Student**: Participate in hackathons

### Coordinator Permissions
Configurable per coordinator:
- `canViewTeams`: View team list
- `canEditTeams`: Modify team details
- `canCheckIn`: Check-in participants
- `canAssignTables`: Assign table numbers
- `canViewSubmissions`: View project submissions
- `canEliminateTeams`: Eliminate teams from rounds
- `canCommunicate`: Send messages to teams

## Subscription Features

### Plan Tiers
Plans can include:
- Max hackathons to organize
- Max team members
- Create hackathons permission
- Invite judges permission
- Analytics access
- Custom branding
- Priority support

### Razorpay Integration
- Subscription creation and management
- Automatic billing
- Webhook handling for status updates
- Payment verification
- Refund support

## Security Features

- Password hashing with bcryptjs
- JWT authentication
- Rate limiting
- Helmet security headers
- Input validation
- CORS protection
- Webhook signature verification

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

Success responses:
```json
{
  "success": true,
  "data": {},
  "message": "Success message"
}
```

## Development

### Project Structure
```
hackathon-backend/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── hackathon.controller.js
│   │   ├── team.controller.js
│   │   └── payment.controller.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Hackathon.js
│   │   ├── Team.js
│   │   └── Subscription.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── hackathon.routes.js
│   │   ├── team.routes.js
│   │   └── payment.routes.js
│   ├── services/
│   │   ├── razorpay.service.js
│   │   └── email.service.js
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

## Testing

```bash
npm test
```

## Deployment

### Environment Variables
Ensure all production environment variables are set:
- Use strong JWT secrets
- Configure production MongoDB URI
- Set up production email service
- Configure Razorpay production keys
- Set NODE_ENV=production

### Webhook Configuration
Configure Razorpay webhook URL:
```
https://your-domain.com/api/payments/webhook
```

## Support

For issues and questions:
- Create an issue in the repository
- Contact: support@hackathonplatform.com

## License

MIT License
