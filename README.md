# AI-Powered Healthcare Platform

A comprehensive healthcare platform with AI-powered diagnostics, health report analysis, doctor consultations, and personalized health recommendations.

## Features

- 🤖 **AI Health Assistant** - Chat with AI about your health reports and symptoms
- 📊 **Health Dashboard** - Track your health metrics and trends
- 📄 **Report Analysis** - Upload and get AI-powered analysis of medical reports
- 👨‍⚕️ **Doctor Consultations** - Book appointments and video consultations
- 🍎 **Personalized Diet Plans** - Get diet recommendations based on your deficiencies
- ⌚ **Wearable Integration** - Connect fitness devices and track activity
- 📱 **Responsive Design** - Works seamlessly on all devices

## Tech Stack

### Frontend
- React 18
- Vite
- TailwindCSS
- React Router
- Recharts (for data visualization)
- Lucide React (icons)

### Backend
- Node.js
- Express
- MongoDB
- JWT Authentication
- Multer (file uploads)
- Node-cron (scheduled tasks)

### Third-Party Services
- Agora (video consultations)
- Nodemailer (email notifications)
- OpenAI/Gemini (AI analysis)

## Getting Started

### Prerequisites
- Node.js 16+ 
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/Colab-Platforms/AI-Diagnostic.git
cd AI-Diagnostic/healthcare-ai-platform
```

2. Install server dependencies
```bash
cd server
npm install
```

3. Install client dependencies
```bash
cd ../client
npm install
```

4. Configure environment variables

Create `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
CLIENT_URL=http://localhost:5173
```

5. Start the development servers

Terminal 1 (Server):
```bash
cd server
npm start
```

Terminal 2 (Client):
```bash
cd client
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Deployment

### Vercel Deployment

1. Install Vercel CLI
```bash
npm install -g vercel
```

2. Login to Vercel
```bash
vercel login
```

3. Deploy
```bash
vercel
```

4. Set environment variables in Vercel dashboard

### Environment Variables for Production

Make sure to set all environment variables in your Vercel project settings:
- `MONGODB_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `CLIENT_URL`

## Project Structure

```
healthcare-ai-platform/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
│   └── package.json
├── server/                # Node.js backend
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── middleware/       # Custom middleware
│   ├── services/         # Business logic
│   └── server.js         # Entry point
└── README.md
```

## Features in Detail

### AI Health Assistant
- Text selection feature - select any text from reports and ask AI
- Context-aware responses
- Health report explanations
- Symptom analysis
- Diet and lifestyle recommendations

### Health Dashboard
- Real-time health metrics
- Trend analysis with charts
- Vitamin and mineral tracking
- Wearable device integration
- Health score calculation

### Report Analysis
- PDF/Image upload support
- AI-powered analysis using Gemini
- Deficiency detection
- Personalized recommendations
- Historical report tracking

### Doctor Consultations
- Browse available doctors
- Book appointments
- Video consultations via Agora
- Consultation summaries
- Email reminders

### Diet Plans
- Personalized based on deficiencies
- Dietary preference support (vegan, vegetarian, non-vegetarian)
- Indian food recommendations
- Meal-wise suggestions
- Supplement recommendations

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Health Reports
- `POST /api/health/upload` - Upload health report
- `GET /api/health/reports` - Get user reports
- `GET /api/health/reports/:id` - Get specific report
- `GET /api/health/dashboard` - Get dashboard data

### Doctors
- `GET /api/doctors` - Get all doctors
- `POST /api/doctors/availability` - Set availability
- `POST /api/doctors/appointments` - Book appointment

### Wearables
- `POST /api/wearables/connect` - Connect device
- `GET /api/wearables/dashboard` - Get wearable data

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@healthai.com or join our Slack channel.

## Acknowledgments

- Gemini AI for health report analysis
- Agora for video consultation infrastructure
- MongoDB for database
- Vercel for hosting
