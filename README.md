# CoachMic - AI Voice Interview Coaching Platform

---

**Introduction:**
CoachMic is a voice-first interview coaching platform that transforms jobseekers from anxious candidates into confident professionals, through AI-driven practice.

**Key Features:**

- Voice interviews with ElevenLabs Conversational AI
- Text interview mode with Gemini 2.5 Flash
- Smart resume analysis with streaming feedback
- AI-powered resume enhancement
- Company intelligence with Google Search grounding (requires Vertex AI)
- AI career coach (pre/post interview)
- Job discovery with fit analysis
- Smart cover letter generation
- Performance analytics with STAR scoring
- Session history and progress tracking
- Resume version management

**Target Users:**

* **First-generation college students** who don't have parents with professional networks to coach them
* **Career changers** entering unfamiliar industries where they don't know the lingo
* **International students** practicing English fluency under pressure
* **Introverts** who need extra reps to feel comfortable speaking about themselves
* **Anyone** who deserves a fair shot but freezes up when it matters most

---

## Technology Stack

### Languages & Frameworks

| Frontend | Backend |
|----------|---------|
| React 18 | Python 3.11 |
| TypeScript | FastAPI |
| Tailwind CSS | |
| Vite | |

### Cloud Services

- **Google AI Studio / Gemini API** - LLM backbone (free tier available)
- **Firebase Auth** - User authentication
- **Cloud Firestore** - Database
- **Cloud Storage** - Resume storage (optional)
- **Vertex AI** - Advanced features (requires billing)

### Partner Technologies

- **ElevenLabs** - Voice interviews (Conversational AI, ASR, TTS)

---

# Getting Started

## Prerequisites

- **Node.js** v18.0.0 or higher
- **Python** 3.11 or higher
- **Firebase Project** ([create one](https://console.firebase.google.com))
- **Google AI Studio API Key** ([get one](https://aistudio.google.com/app/apikey))
- **ElevenLabs Account** (optional, for voice interviews) ([sign up](https://elevenlabs.io/))

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/patrickndille/coachmic.git
cd coachmic
```

---

## Step 2: Firebase Project Setup

### 2.1 Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"** (or select an existing one)
3. Enter a project name (e.g., `coachmic-project`)
4. Follow the prompts to complete project creation

### 2.2 Register a Web App

1. In your Firebase project, click the **gear icon** → **Project Settings**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** (`</>`) to add a web app
4. Enter an app nickname (e.g., `CoachMic Web`)
5. Click **"Register app"**
6. **Copy the `firebaseConfig` values** - you'll need these for the frontend

### 2.3 Enable Authentication

1. In Firebase Console, go to **Authentication** → **Get started**
2. Go to **Sign-in method** tab
3. Enable **Google** provider:
   - Toggle **Enable**
   - Add your support email
   - Click **Save**
4. (Optional) Enable other providers: Microsoft, Apple, GitHub
5. Go to **Settings** tab → **Authorized domains**
6. Click **Add domain** and add: `localhost`

### 2.4 Create Cloud Firestore Database

1. In Firebase Console, go to **Firestore Database** → **Create database**
2. Choose **Start in test mode** (for development)
3. Select a location closest to you
4. Click **Enable**

### 2.5 Enable Required Google Cloud APIs

Your Firebase project is linked to Google Cloud. Enable these APIs:

1. **Cloud Firestore API**:
   ```
   https://console.cloud.google.com/apis/api/firestore.googleapis.com/overview?project=YOUR_PROJECT_ID
   ```
   Click **Enable** and wait a few minutes for propagation.

2. **Identity Toolkit API** (usually enabled automatically with Firebase Auth)

### 2.6 Generate Firebase Admin SDK Key (for Backend)

1. In Firebase Console, go to **Project Settings** → **Service accounts**
2. Click **"Generate new private key"**
3. Download the JSON file
4. Save it to the `backend/` folder (e.g., `backend/firebase-admin-key.json`)

> ⚠️ **Important:** Never commit this file to git! It's already in `.gitignore`.

---

## Step 3: Get Google AI Studio API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Select your Firebase/GCP project
4. Copy the API key

> **Note:** The free tier of Google AI Studio has generous limits for `gemini-2.5-flash`. Some advanced features (Company Intel, Reader Mode TTS) require Vertex AI with billing enabled.

---

## Step 4: Deploy Firestore Indexes

The app requires composite indexes for Firestore queries to work properly.

```bash
cd frontend

# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase (use the account that owns the project)
firebase logout
firebase login

# Select your project
firebase use YOUR_PROJECT_ID

# Deploy indexes
firebase deploy --only firestore:indexes
```

You should see:
```
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

---

## Step 5: Backend Setup

### 5.1 Create Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
```

### 5.2 Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5.3 Configure Environment Variables

```bash
cp .env.example .env
```

Edit `backend/.env` with your values:

```bash
# Application
APP_NAME=CoachMic
DEBUG=true
ENVIRONMENT=development

# Server
HOST=0.0.0.0
PORT=8000

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Google Cloud Platform
GCP_PROJECT_ID=your-firebase-project-id
GCP_LOCATION=us-central1

# Google AI Studio API Key (free tier)
# Get yours at: https://aistudio.google.com/app/apikey
GCP_API_KEY=your-google-ai-studio-api-key

# Gemini Model Configuration
# Using gemini-2.5-flash for all tasks (higher free tier limits)
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_RESUME_PARSE=gemini-2.5-flash
GEMINI_MODEL_ATS_SCORE=gemini-2.5-flash
GEMINI_MODEL_RESUME_IMPROVE=gemini-2.5-flash
GEMINI_MODEL_COVER_LETTER=gemini-2.5-flash
GEMINI_MODEL_TEXT_INTERVIEW=gemini-2.5-flash
GEMINI_MODEL_FEEDBACK=gemini-2.5-flash

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_ADMIN_KEY_PATH=firebase-admin-key.json

# ElevenLabs (optional - for voice interviews)
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_AGENT_ID=your-agent-id

# JSearch API (optional - for job search)
JSEARCH_API_KEY=your-jsearch-api-key

# Cloud Storage (optional - for resume file storage)
# GCS_BUCKET_NAME=your-bucket-name

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# File Upload
MAX_UPLOAD_SIZE=5242880
```

### 5.4 Start the Backend Server

```bash
uvicorn app.main:app --reload --port 8000
```

You should see:
```
[Gemini] Using Google AI Studio with API key
[Firebase] Initialized successfully for project: your-project-id
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## Step 6: Frontend Setup

### 6.1 Install Dependencies

```bash
cd frontend
npm install
```

### 6.2 Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `frontend/.env.local` with your Firebase config:

```bash
# Backend API URL
VITE_API_URL=http://localhost:8000

# ElevenLabs (optional - for voice interviews)
VITE_ELEVENLABS_AGENT_ID=your-agent-id

# Firebase Configuration
# Get these values from Firebase Console → Project Settings → Your apps
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

### 6.3 Start the Frontend Server

```bash
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## Step 7: Access the Application

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:8000 |
| **API Docs** | http://localhost:8000/docs |

---

# Feature Availability

Some features require additional configuration:

| Feature | Google AI Studio (Free) | Vertex AI (Billing) | Other Requirements |
|---------|-------------------------|---------------------|-------------------|
| Resume Analysis | ✅ | ✅ | - |
| ATS Scoring | ✅ | ✅ | - |
| Resume Improvement | ✅ | ✅ | - |
| Text Interview | ✅ | ✅ | - |
| Feedback Generation | ✅ | ✅ | - |
| Cover Letter | ✅ | ✅ | - |
| Job Search | ✅ | ✅ | JSearch API Key |
| Voice Interview | ✅ | ✅ | ElevenLabs API Key |
| **Reader Mode (TTS)** | ❌ | ✅ | Vertex AI |
| **Company Intel (Search)** | ❌ | ✅ | Vertex AI |

---

# Troubleshooting

### "Firebase not initialized" error
- Ensure `FIREBASE_ADMIN_KEY_PATH` points to a valid JSON file
- Check that the JSON file is in the `backend/` directory

### "Cloud Firestore API has not been used" error
- Enable the Firestore API: `https://console.cloud.google.com/apis/api/firestore.googleapis.com/overview?project=YOUR_PROJECT_ID`
- Wait 2-3 minutes for propagation

### "The query requires an index" error
- Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- Make sure you're logged into the correct Firebase account

### "auth/configuration-not-found" error
- Enable Authentication in Firebase Console
- Enable at least one sign-in provider (e.g., Google)
- Add `localhost` to authorized domains

### "RESOURCE_EXHAUSTED" / Quota error
- You've hit the free tier limits
- Use `gemini-2.5-flash` instead of `gemini-2.5-pro` (higher limits)
- Wait for quota reset or enable billing

### "Missing or insufficient permissions" error
- Check that the Firebase Admin SDK key has proper permissions
- Ensure Firestore is in test mode or has appropriate security rules

---

# Build and Test

### Frontend

```bash
cd frontend
npm run build        # Production build
npm run test         # Run tests
npm run test:coverage # Test with coverage
npm run lint         # Lint code
```

### Backend

```bash
cd backend
pytest tests/ -v           # Run all tests
pytest --cov=app           # Test with coverage
black . && isort .         # Format code
flake8                     # Lint code
```

### Docker

```bash
# Build and run backend
docker build -t coachmic-api ./backend
docker run -p 8080:8080 coachmic-api

# Or use docker-compose
docker-compose up
```

---

# Contribute

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style (ESLint for frontend, Black for backend)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

### Report Issues

Found a bug or have a suggestion? [Open an issue](https://github.com/patrickndille/coachmic/issues) with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

---

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
