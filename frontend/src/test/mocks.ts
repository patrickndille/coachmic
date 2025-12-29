/**
 * Mock data for testing
 */

import { ResumeData, FeedbackData } from '../types';

// SessionData type for tests
export interface SessionData {
  sessionId: string;
  status: string;
  createdAt: string;
}

export const mockResumeData: ResumeData = {
  fileName: 'resume.pdf',
  name: 'Patrick Ejelle-Ndille',
  email: 'patrick@example.com',
  phone: '(123) 456-7890',
  summary: 'Back-End Tester and QA Analyst with 2+ years of experience',
  skills: ['Python', 'JavaScript', 'FastAPI', 'React', 'SQL', 'Docker', 'Git'],
  suggestedQuestions: ['Tell me about your API testing experience', 'How do you approach security testing?'],
  experiences: [
    {
      company: 'Guhuza Technologies',
      title: 'Back-End Tester / QA Analyst',
      startDate: 'Jan 2023',
      endDate: 'Present',
      description: 'Back-End Tester and QA Analyst responsible for API testing and quality assurance',
      highlights: [
        'Conducted comprehensive API testing',
        'Identified 50+ critical bugs',
        'Implemented automated testing pipelines',
      ],
    },
  ],
  education: [
    {
      institution: 'triOS College',
      degree: 'Information Technology Diploma',
      graduationDate: 'Expected January 2026',
    },
  ],
  keyAchievements: ['2x IBM Hackathon Winner', 'CompTIA Security+ certified'],
  suggestedRoles: ['Backend Developer', 'QA Engineer', 'Security Analyst'],
  skillGraph: {
    technical: [
      { name: 'Python', level: 'expert', years: 3 },
      { name: 'API Testing', level: 'expert', years: 2 },
    ],
    soft: [{ name: 'Problem Solving', level: 'expert' }],
    certifications: ['CompTIA Security+'],
  },
  careerSignals: {
    seniorityLevel: 'Mid-level',
    yearsExperience: 4,
    careerTrajectory: 'Upward',
    industryFocus: ['Technology', 'Software'],
  },
  starStories: [
    {
      theme: 'Critical Security Vulnerability',
      situation: 'Reports of security vulnerabilities in authentication',
      task: 'Identify all potential security issues',
      action: 'Conducted comprehensive security testing',
      result: 'Found and fixed critical MFA bypass before exploitation',
      metrics: [],
      keywords: [],
    },
  ],
  talkingPoints: {
    elevatorPitch: 'Experienced QA professional specializing in security testing',
    keyStrengths: ['Security testing', 'API testing', 'Problem solving'],
    uniqueValue: '2x hackathon winner, Security certified',
  },
};

export const mockSessionData: SessionData = {
  sessionId: 'test-session-123',
  status: 'created',
  createdAt: new Date().toISOString(),
};

export const mockFeedbackData: FeedbackData = {
  sessionId: 'test-session-123',
  overallScore: 78,
  categoryScores: {
    content: 75,
    delivery: 68,
    structure: 80,
    relevance: 85,
  },
  speakingMetrics: {
    wordsPerMinute: 145,
    fillerWordCount: 8,
    fillerWords: ['um', 'like', 'you know'],
    averageResponseTime: 2.3,
    totalSpeakingTime: 180,
  },
  strengths: [
    'Used STAR method effectively',
    'Provided specific technical details',
    'Demonstrated problem-solving skills',
  ],
  areasForImprovement: [
    'Reduce filler words (um, like, you know)',
    'Speak more confidently without hedging',
    'Provide more quantifiable results',
  ],
  questionFeedback: [
    {
      questionId: 'q1',
      question: 'Tell me about a challenging project you worked on.',
      userResponse: 'Discussed security testing at Guhuza',
      score: 78,
      feedback: 'Good use of STAR method, but contained several filler words',
      starAnalysis: {
        situation: 'Security vulnerabilities in authentication',
        task: 'Identify potential issues',
        action: 'Comprehensive security testing',
        result: 'Fixed critical MFA bypass',
      },
      suggestedImprovement: 'Reduce filler words and speak more confidently',
    },
  ],
  generatedAt: new Date().toISOString(),
};

export const mockTranscript = [
  {
    speaker: 'agent' as const,
    text: 'Tell me about a challenging project you worked on.',
    timestamp: 1000,
  },
  {
    speaker: 'user' as const,
    text: 'I worked on a challenging security testing project at Guhuza...',
    timestamp: 3000,
  },
];

// Mock API responses
export const mockApiResponses = {
  createSession: {
    sessionId: 'test-session-123',
    status: 'created',
    createdAt: new Date().toISOString(),
  },
  parseResume: mockResumeData,
  generateFeedback: mockFeedbackData,
};
