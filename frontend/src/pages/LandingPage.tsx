import { useNavigate } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  CheckIcon,
  CogIcon,
  ComputerDesktopIcon,
  ArrowUpTrayIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon
} from '@heroicons/react/24/solid';
import { useApp } from '../context/AppContext';
import AnimatedHeroDemo from '../components/landing/AnimatedHeroDemo';

export default function LandingPage() {
  const navigate = useNavigate();
  const { dispatch } = useApp();

  const handleStart = () => {
    // Always start fresh - clear any old session data
    dispatch({ type: 'RESET_SESSION' });
    navigate('/setup');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Hero Section */}
      <section className="py-12 md:py-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text Content */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <SparklesIcon className="w-4 h-4" />
                AI-Powered Interview Practice
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Practice Interviews Out Loud.
                <br />
                <span className="text-primary-600">Get AI Feedback. Land the Job.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                93% of job seekers feel interview anxiety. CoachMic lets you practice speaking with an AI interviewer and get instant feedback on your answers.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
                <button
                  onClick={handleStart}
                  className="btn-primary text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  Start Free Practice →
                </button>
                <button
                  onClick={() => navigate('/guide')}
                  className="text-lg px-8 py-4 rounded-xl border-2 border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition-all"
                >
                  View Demo
                </button>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500" />
                  No account required
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500" />
                  5-minute interview
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500" />
                  Instant feedback
                </div>
              </div>
            </div>

            {/* Right Side - Animated Demo */}
            <div className="relative lg:pl-8">
              <AnimatedHeroDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Value Props - The Complete Career Preparation Ecosystem */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            The Complete Career Preparation Ecosystem
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Everything you need to land your dream job, from resume optimization to interview mastery.
          </p>

          {/* PREPARE Phase */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-100 px-3 py-1 rounded-full">
                Prepare
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Smart Resume Analysis */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <DocumentMagnifyingGlassIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Smart Resume Analysis</h3>
                <p className="text-gray-600">
                  AI extracts STAR stories, skills, and talking points. Get your ATS compatibility score and keyword gap analysis.
                </p>
              </div>

              {/* AI Resume Enhancement */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <ArrowUpTrayIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Resume Enhancement</h3>
                <p className="text-gray-600">
                  Transform your resume with AI-powered improvements. Better phrasing, optimized keywords, and one-click generation.
                </p>
              </div>

              {/* Company Research */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <BuildingOffice2Icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Company Research</h3>
                <p className="text-gray-600">
                  Walk into interviews informed. AI-curated company insights, recent news, and culture signals from Google Search.
                </p>
              </div>
            </div>
          </div>

          {/* PRACTICE Phase */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-100 px-3 py-1 rounded-full">
                Practice
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Voice Interviews */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Voice Interviews</h3>
                <p className="text-gray-600">
                  Talk naturally like a real interview with ElevenLabs AI. Resume-aware questions with intelligent follow-ups.
                </p>
              </div>

              {/* Text Interview Mode */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <ComputerDesktopIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Text Interview Mode</h3>
                <p className="text-gray-600">
                  Interview anywhere, anytime. Perfect for quiet environments or accessibility needs. Same AI-powered experience.
                </p>
              </div>

              {/* AI Career Coach */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <SparklesIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Career Coach</h3>
                <p className="text-gray-600">
                  Pre & post-interview coaching with text or voice. Refine answers and improve based on your performance.
                </p>
              </div>
            </div>
          </div>

          {/* SUCCEED Phase */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-100 px-3 py-1 rounded-full">
                Succeed
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Job Discovery */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <MagnifyingGlassIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Job Discovery</h3>
                <p className="text-gray-600">
                  Find real jobs matched to your resume with AI-powered fit analysis and career trajectory insights.
                </p>
              </div>

              {/* Smart Cover Letters */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <EnvelopeIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Smart Cover Letters</h3>
                <p className="text-gray-600">
                  Generate personalized cover letters tailored to each job. AI matches your experience to requirements.
                </p>
              </div>

              {/* Performance Analytics */}
              <div className="card text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <ChartBarIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Performance Analytics</h3>
                <p className="text-gray-600">
                  Track STAR scores, filler words, and speaking pace. Get question-by-question feedback with PDF export.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Upload Your Resume',
                description:
                  'AI analyzes your experience to extract STAR stories, skills, and talking points.',
              },
              {
                step: '2',
                title: 'Discover Matched Jobs (Optional)',
                description:
                  'Browse real job opportunities matched to your resume with fit analysis and career insights.',
              },
              {
                step: '3',
                title: 'Choose Role & Interview Type',
                description:
                  'Select your target role, company, and interview type (behavioral, technical, or mixed).',
              },
              {
                step: '4',
                title: 'Get Pre-Interview Coaching (Optional)',
                description:
                  'Refine your answers with AI coaching before the realistic voice interview.',
              },
              {
                step: '5',
                title: 'Practice Voice Interview',
                description:
                  'Have a 5-7 question voice conversation with your AI interviewer in real-time.',
              },
              {
                step: '6',
                title: 'Review Feedback & Improve',
                description:
                  'Get detailed scores, STAR analysis, and post-interview coaching to strengthen weak areas.',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom ElevenLabs Setup Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            {/* ElevenLabs Logo - following brand guidelines (black on white) */}
            <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-2xl flex items-center justify-center shadow-md p-3">
              <img
                src="https://11labs-nonprd-15f22c1d.s3.eu-west-3.amazonaws.com/0b9cd3e1-9fad-4a5b-b3a0-c96b0a1f1d2b/elevenlabs-logo-black.png"
                alt="ElevenLabs"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Use Your Own ElevenLabs Account
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Want more control? Connect your own ElevenLabs API to customize your AI interviewer's voice,
              personality, and behavior. Get your own usage quota and unlimited practice sessions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <CogIcon className="w-5 h-5 text-gray-800" />
                Benefits
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Choose from 5,000+ voices</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Customize interviewer personality</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Practice on your own usage quota</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>No shared hard limits</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-gray-800" />
                What You'll Need
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">1</span>
                  <span>ElevenLabs account (free tier available)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">2</span>
                  <span>API Key from your ElevenLabs profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">3</span>
                  <span>Agent ID from your Conversational AI agent</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">4</span>
                  <span>~5 minutes of your time</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-md border-2 border-gray-300 text-center">
            <h3 className="font-semibold text-xl mb-3 text-gray-900">
              Ready to Set Up Your Own ElevenLabs Agent?
            </h3>
            <p className="text-gray-600 mb-6">
              Follow our step-by-step guide to create your API key, set up your agent,
              and connect it to CoachMic in just 10 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/guide?tab=elevenlabs-setup')}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <DocumentTextIcon className="w-5 h-5" />
                View Setup Guide
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg border-2 border-gray-900 hover:bg-gray-50 transition-colors"
              >
                <CogIcon className="w-5 h-5" />
                Go to Settings
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Already have your credentials? Add them in Settings → ElevenLabs Configuration
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-primary-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Practice?</h2>
          <p className="text-primary-100 mb-8">
            Your next interview could be the one. Be prepared.
          </p>
          <button
            onClick={handleStart}
            className="bg-white text-primary-600 font-semibold px-8 py-4 rounded-xl hover:bg-primary-50 transition-colors"
          >
            Start Your Free Practice Session
          </button>
        </div>
      </section>
    </div>
  );
}
