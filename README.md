# CoachMic - AI Voice Interview Coaching Platform
--------------------------------------------------------------------------

**Introduction:** 
CoachMic is a voice-first interview coaching platform that transforms jobseekers from anxious candidates into confident professionals, through realising AI-driven practice.

**Key Features:**   
   - Voice interviews with ElevenLabs Conversational AI
   - Text interview mode with Gemini 2.5 Pro
   - Smart resume analysis with streaming feedback
   - AI-powered resume enhancement
   - Company intelligence with Google Search grounding
   - AI career coach (pre/post interview)
   - Job discovery with fit analysis
   - Smart cover letter generation
   - Performance analytics with STAR scoring
   - Session history and progress tracking
   - Resume version management
   

**Target Users:**
*   **First-generation college students** who don't have parents with professional networks to coach them
*   **Career changers** entering unfamiliar industries where they don't know the lingo
*   **International students** practicing English fluency under pressure
*   **Introverts** who need extra reps to feel comfortable speaking about themselves
*   **Anyone** who deserves a fair shot but freezes up when it matters most


**Consideration Factors**
* External Data Needed to run the application: Document Resume (PDF/DOCX)
* Main Integrations: 3 external API, ElevenLabs + Vertex AI / Gemini, JSearch



* * *

**Technology Stack**
----------

### Languages & Frameworks

    Frontend:
    - React 18
    - TypeScript
    - Tailwind CSS
    - Vite
    
    Backend:
    - Python 3.11
    - FastAPI
    

### Cloud Services (Google Cloud Platform)

    - Vertex AI / Gemini API (LLM backbone)
    - Cloud Run (serverless backend hosting)
    - Cloud Storage (resume storage, optional)
    - Secret Manager (API key management)
    

### Partner Technologies (ElevenLabs)

    - ElevenLabs Conversational AI Platform
    - ElevenLabs React SDK
    - Speech-to-Text (ASR)
    - Text-to-Speech (TTS)
    - Turn-taking Model
    

### APIs & Integrations

    - ElevenLabs Conversational AI API
    - Google Gemini API (via Vertex AI)
    
### Supporting Services

    - Vercel (Frontend Hosting, CDN, DNS)
    - Firebase Auth (User authentication)
    

### About the Builder
**Patrick Ejelle-Ndille**
*   🎓 Built before Graduating, January 2026 from triOS College (Information Technology)
*   💼 Currently: Back-End Tester / QA Analyst at [Guhuza](https://guhuza.com/)
*   🏆 2x IBM TechXchange watsonx.ai Hackathon Winner (BrainStormX, Meeting Ledger)
*   🔐 Cybersecurity specialist (CompTIA Security+ CE, Azure certified)
*   🌐 [LinkedIn](https://linkedin.com/in/patrickndille) | [GitHub]


# Getting Started

### Prerequisites

- **Node.js** v18.0.0 or higher
- **Python** 3.11 or higher
- **ElevenLabs Account** with API key ([sign up](https://elevenlabs.io/))
- **Google Cloud Account** with Vertex AI enabled ([console](https://console.cloud.google.com/))

### Quick Start

```bash
# Clone the repository
git clone https://github.com/patrickndille/coachmic.git
cd coachmic

# Backend Setup (Terminal 1)
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Edit with your API keys
uvicorn main:app --reload --port 8080

# Frontend Setup (Terminal 2)
cd frontend
npm install
cp .env.local.example .env.local  # Edit with API URL
npm run dev
```

### Environment Variables

**Backend (`backend/.env`):**
```
ELEVENLABS_API_KEY=sk_your_key_here
ELEVENLABS_AGENT_ID=agent_your_id_here
GOOGLE_CLOUD_PROJECT=your-project-id
```

**Frontend (`frontend/.env.local`):**
```
VITE_API_URL=http://localhost:8080
VITE_ELEVENLABS_AGENT_ID=agent_your_id_here
```

### Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080
- **API Docs:** http://localhost:8080/docs

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
pytest --cov=src           # Test with coverage
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