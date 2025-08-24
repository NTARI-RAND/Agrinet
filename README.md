# Agrinet - Decentralized Agricultural Marketplace 🌱

## Overview

Agrinet is a decentralized agricultural trading and service platform built to enhance transparency, trust, and efficiency in agricultural markets. It connects producers, consumers, and service providers while ensuring secure transactions, reputation-based ratings, and localized economic sustainability.

## Features

#### Marketplace System 🏪 

- Direct Market Access: Producers list goods, services, and contracts.
- Agrotourism Integration: Farmers can offer farm tours, events, and educational workshops.
- Service Marketplace: Users can provide or request agricultural services (e.g., logistics, maintenance).

#### Secure Transactions 🔒

- LBTAS (Leveson-Based Trade Assessment Scale): Ensures a trust-based rating system.
- Dialog Recorder: Logs key transaction details for security and auditing.
- Machine Scrub Module: Filters and verifies transaction data.

#### Key & Authentication System 🔑

- McEliese Key Generation: Ensures secure user identification.
- Key Transmission Limits: Auto-retirement after 3, 6, 9, 12, or 365 transmissions.
- Multi-Factor Verification: Email/phone validation with retry & lockout security.

#### PING System 📡

- Production Progress Reporting: Allows contract buyers to track order status.
- Real-Time Notifications: Updates on market trends, contract changes, and service requests.

#### SMS Access 📱

- Query market and weather data through SMS using simple text commands.
- Supports local languages and queues messages offline with delivery confirmation.

#### Financial Transactions 🏦

- Deposit & Donations to NTARI Account: Supports decentralized funding.
- Automated Payouts: Ensures secure fund disbursements upon transaction completion.

#### Decentralized Data Management 🌍

- User Profiles & Logs: Maintains key issuance logs parallel to user profiles.
- Geo-Filtering & Search Optimization: Enables market visibility based on location.

## Technology Stack

- Frontend: WIX (for web interface & UI logic)
- Backend: Node.js (API handling)
- Database: Amazon DynamoDB (for storing users, contracts, and transactions)
- Security: OAuth 2.0 / McEliese Key Cryptography
- Real-Time Processing: Webhooks & PING System

## Installation & Setup

1. Clone the repository
```
git clone https://github.com/YOUR_USERNAME/Fruitful.git
cd Agrinet
```

2. Setup the backend
```
cd backend
npm install
node server.js
```

3. Deploy the frontend
- TBD

### Environment Variables

The backend now uses Amazon DynamoDB. Set the following variables in your environment or `.env` file:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `DYNAMODB_ENDPOINT` *(optional, for DynamoDB Local e.g. `http://localhost:8000`)*
- `TWILIO_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_STATUS_CALLBACK_URL` *(optional for delivery confirmation)*

## API Endpoints
### User Registration
#### POST /userRegistration
```
{
  "name": "John Doe",
  "email": "johndoe@example.com",
  "location": "Kentucky, USA",
  "role": "producer"
}
```

### Create Contract
#### POST /createContract
```
{
  "producerId": "user123",
  "type": "Tomato",
  "variety": "Roma",
  "category": "food",
  "amountNeeded": "500 lbs",
  "dateNeeded": "2025-03-15",
  "pingRate": "weekly"
}
```

### Submit LBTAS Rating
#### POST /submitRating
```
{
  "transactionId": "tx987",
  "rating": 4
}
```

## Contributing
We welcome contributions from the community! 🚀

1. Fork the repo
2. Create a feature branch
3. Submit a pull request

## License
MIT License – Feel free to modify and share. 📜

## Contact & Support
- NTARI https://www.ntari.org/ 
- Email - tech@ntari.org
- Slack - [Join our community for discussions!](https://ntari.slack.com) 
