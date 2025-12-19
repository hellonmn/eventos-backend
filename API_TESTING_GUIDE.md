# API Testing Guide

## Setup

1. Import this collection into Postman or any API client
2. Set environment variables:
   - `base_url`: http://localhost:5000
   - `token`: (will be set automatically after login)

## Authentication Flow

### 1. Register User
```
POST {{base_url}}/api/auth/register
```
Body:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "fullName": "Test User",
  "phone": "+1234567890",
  "institution": "Test University"
}
```

### 2. Login
```
POST {{base_url}}/api/auth/login
```
Body:
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
Response will include token - save it for subsequent requests.

### 3. Get Current User
```
GET {{base_url}}/api/auth/me
Headers:
  Authorization: Bearer {{token}}
```

## Hackathon Management

### Create Hackathon
```
POST {{base_url}}/api/hackathons
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "title": "AI Innovation Challenge 2025",
  "description": "Build innovative AI solutions for real-world problems",
  "theme": "Artificial Intelligence",
  "tags": ["AI", "Machine Learning", "Innovation"],
  "registrationStartDate": "2025-01-01T00:00:00Z",
  "registrationEndDate": "2025-01-31T23:59:59Z",
  "hackathonStartDate": "2025-02-01T00:00:00Z",
  "hackathonEndDate": "2025-02-03T23:59:59Z",
  "teamConfig": {
    "minMembers": 1,
    "maxMembers": 4,
    "allowSoloParticipation": true
  },
  "maxTeams": 100,
  "mode": "hybrid",
  "registrationFee": {
    "amount": 500,
    "currency": "INR"
  },
  "paymentOptions": {
    "perTeam": {
      "enabled": true,
      "amount": 500
    },
    "perParticipant": {
      "enabled": false
    }
  },
  "rounds": [
    {
      "name": "Idea Submission",
      "type": "submission",
      "mode": "online",
      "startTime": "2025-02-01T00:00:00Z",
      "endTime": "2025-02-01T23:59:59Z",
      "maxScore": 50,
      "judgingCriteria": [
        {
          "name": "Innovation",
          "maxPoints": 25
        },
        {
          "name": "Feasibility",
          "maxPoints": 25
        }
      ],
      "isEliminationRound": true,
      "eliminationCount": 20,
      "order": 1
    },
    {
      "name": "Final Presentation",
      "type": "presentation",
      "mode": "offline",
      "startTime": "2025-02-02T09:00:00Z",
      "endTime": "2025-02-02T18:00:00Z",
      "maxScore": 100,
      "judgingCriteria": [
        {
          "name": "Innovation",
          "maxPoints": 30
        },
        {
          "name": "Technical Implementation",
          "maxPoints": 30
        },
        {
          "name": "Presentation",
          "maxPoints": 20
        },
        {
          "name": "Impact",
          "maxPoints": 20
        }
      ],
      "order": 2
    }
  ],
  "schedule": [
    {
      "title": "Opening Ceremony",
      "startTime": "2025-02-01T09:00:00Z",
      "endTime": "2025-02-01T10:00:00Z",
      "type": "opening"
    },
    {
      "title": "Hacking Begins",
      "startTime": "2025-02-01T10:00:00Z",
      "endTime": "2025-02-02T10:00:00Z",
      "type": "other"
    }
  ],
  "prizes": [
    {
      "position": "1st",
      "title": "Winner",
      "amount": 100000,
      "description": "Cash prize and goodies"
    },
    {
      "position": "2nd",
      "title": "Runner Up",
      "amount": 50000
    }
  ],
  "venue": {
    "name": "Tech Hub Convention Center",
    "address": "123 Tech Street",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "contactEmail": "contact@aichallenge.com",
  "status": "draft"
}
```

### Get All Hackathons
```
GET {{base_url}}/api/hackathons?status=registration_open&page=1&limit=10
```

### Invite Coordinator
```
POST {{base_url}}/api/hackathons/:hackathonId/coordinators/invite
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "emailOrUsername": "coordinator@example.com",
  "permissions": {
    "canViewTeams": true,
    "canEditTeams": false,
    "canCheckIn": true,
    "canAssignTables": true,
    "canViewSubmissions": true,
    "canEliminateTeams": false,
    "canCommunicate": true
  }
}
```

### Accept Coordinator Invitation
```
POST {{base_url}}/api/hackathons/coordinators/accept/:token
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "hackathonId": "hackathon_id_here"
}
```

### Update Coordinator Permissions
```
PUT {{base_url}}/api/hackathons/:hackathonId/coordinators/:userId/permissions
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "permissions": {
    "canEliminateTeams": true,
    "canEditTeams": true
  }
}
```

### Get My Coordinations
```
GET {{base_url}}/api/hackathons/my/coordinations
Headers:
  Authorization: Bearer {{token}}
```

### Invite Judge
```
POST {{base_url}}/api/hackathons/:hackathonId/judges/invite
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "emailOrUsername": "judge@example.com",
  "assignedRounds": ["round_id_1", "round_id_2"]
}
```

## Team Management

### Register Team
```
POST {{base_url}}/api/teams/register
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "hackathonId": "hackathon_id",
  "teamName": "Team Innovation",
  "members": ["user_id_1", "user_id_2", "user_id_3"],
  "projectTitle": "AI-Powered Healthcare Assistant",
  "projectDescription": "An intelligent system to assist doctors with diagnosis"
}
```

### Get Teams (Coordinator View)
```
GET {{base_url}}/api/teams/hackathon/:hackathonId?status=approved&page=1&limit=20
Headers:
  Authorization: Bearer {{token}}
```

### Get My Teams
```
GET {{base_url}}/api/teams/my
Headers:
  Authorization: Bearer {{token}}
```

### Check-in Team
```
POST {{base_url}}/api/teams/:teamId/checkin
Headers:
  Authorization: Bearer {{token}}
```

### Check-in Individual Member
```
POST {{base_url}}/api/teams/:teamId/members/:memberId/checkin
Headers:
  Authorization: Bearer {{token}}
```

### Assign Table and Team Number
```
PUT {{base_url}}/api/teams/:teamId/assign
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "tableNumber": "T-12",
  "teamNumber": "TEAM-042"
}
```

### Submit Project
```
POST {{base_url}}/api/teams/:teamId/submit
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "roundId": "round_id",
  "projectLink": "https://myproject.com",
  "demoLink": "https://demo.myproject.com",
  "videoLink": "https://youtube.com/watch?v=xxx",
  "githubRepo": "https://github.com/user/project",
  "presentationLink": "https://slides.com/presentation",
  "description": "Detailed project description",
  "techStack": ["React", "Node.js", "MongoDB", "TensorFlow"]
}
```

### Score Team (Judge)
```
POST {{base_url}}/api/teams/:teamId/score
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "roundId": "round_id",
  "criteriaScores": [
    {
      "criteriaName": "Innovation",
      "score": 28,
      "maxScore": 30
    },
    {
      "criteriaName": "Technical Implementation",
      "score": 25,
      "maxScore": 30
    },
    {
      "criteriaName": "Presentation",
      "score": 18,
      "maxScore": 20
    },
    {
      "criteriaName": "Impact",
      "score": 17,
      "maxScore": 20
    }
  ],
  "remarks": "Excellent project with strong technical implementation",
  "feedback": "Great innovation! Consider improving the user interface and adding more documentation."
}
```

### Eliminate Team
```
POST {{base_url}}/api/teams/:teamId/eliminate
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "roundId": "round_id",
  "reason": "Did not meet minimum score threshold for this round"
}
```

### Get Leaderboard
```
GET {{base_url}}/api/teams/hackathon/:hackathonId/leaderboard
Optional query params: ?roundId=round_id
```

## Payment & Subscription

### Get Subscription Plans
```
GET {{base_url}}/api/payments/subscription-plans
```

### Create Subscription Plan (Admin)
```
POST {{base_url}}/api/payments/subscription-plans
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "name": "premium",
  "displayName": "Premium Plan",
  "description": "Perfect for regular organizers",
  "price": {
    "amount": 999,
    "currency": "INR"
  },
  "billingCycle": "monthly",
  "features": {
    "maxHackathons": 5,
    "maxTeamMembers": 10,
    "canCreateHackathons": true,
    "canInviteJudges": true,
    "analytics": true,
    "customBranding": false,
    "prioritySupport": true,
    "removeWatermark": true
  }
}
```

### Subscribe to Plan
```
POST {{base_url}}/api/payments/subscribe
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "planId": "plan_id_here"
}
```

### Create Hackathon Payment Order
```
POST {{base_url}}/api/payments/hackathon/create-order
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "teamId": "team_id_here"
}
```

### Verify Payment
```
POST {{base_url}}/api/payments/hackathon/verify
Headers:
  Authorization: Bearer {{token}}
```
Body:
```json
{
  "teamId": "team_id_here",
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "signature_xxx"
}
```

### Cancel Subscription
```
POST {{base_url}}/api/payments/subscription/cancel
Headers:
  Authorization: Bearer {{token}}
```

## Testing Workflow

### Complete Flow for Organizer

1. Register/Login as organizer
2. Subscribe to a plan (if required)
3. Create hackathon
4. Invite coordinators with specific permissions
5. Invite judges
6. Publish hackathon (update status to "registration_open")

### Complete Flow for Student

1. Register/Login
2. Browse hackathons
3. Form team and register
4. Make payment (if required)
5. Wait for approval
6. Submit project for rounds
7. View leaderboard

### Complete Flow for Coordinator

1. Register/Login
2. Accept coordinator invitation
3. View "My Coordinations"
4. Access hackathon team list
5. Check-in participants
6. Assign table numbers
7. View submissions (if permitted)

### Complete Flow for Judge

1. Register/Login
2. Accept judge invitation
3. Access assigned hackathon
4. View team submissions
5. Score teams based on criteria
6. View leaderboard

## Common Issues & Solutions

### Issue: "Not authorized"
- Ensure you're logged in and token is valid
- Check if user has required role/permission

### Issue: "Registration not open"
- Check hackathon dates
- Verify hackathon status is "registration_open"

### Issue: "Already registered"
- User can only be in one team per hackathon
- Coordinators cannot participate in their hackathons

### Issue: "Payment verification failed"
- Verify Razorpay signature is correct
- Check Razorpay credentials in .env

### Issue: "Team size invalid"
- Respect min/max member limits set by organizer
- Check teamConfig in hackathon details

## Notes

- All dates should be in ISO 8601 format
- Amounts are in smallest currency unit (paise for INR)
- JWT tokens expire based on JWT_EXPIRE env variable
- Rate limiting applies to all endpoints
