import {
  BookOpenIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  ChartBarIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  QuestionMarkCircleIcon,
  ComputerDesktopIcon,
  CheckIcon,
  SparklesIcon,
  StarIcon,
  LightBulbIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/solid';

export function UserManualContent() {
  return (
    <div className="space-y-8">
      {/* Hero Introduction */}
      <section className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-100">
        <div className="flex items-start gap-4">
          <div className="bg-white p-3 rounded-full shadow-sm">
            <BookOpenIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Complete User Manual</h2>
            <p className="text-gray-700">
              Everything you need to know about CoachMic—from basic setup to advanced features. 
              Use the sections below to learn about each feature in detail.
            </p>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="bg-white border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">📑 In This Guide</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <a href="#introduction" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <BookOpenIcon className="w-4 h-4 text-indigo-500" />
            <span>Introduction</span>
          </a>
          <a href="#getting-started" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <ComputerDesktopIcon className="w-4 h-4 text-green-500" />
            <span>Getting Started</span>
          </a>
          <a href="#resume-upload" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <DocumentTextIcon className="w-4 h-4 text-blue-500" />
            <span>Resume Upload & Analysis</span>
          </a>
          <a href="#job-discovery" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <BriefcaseIcon className="w-4 h-4 text-purple-500" />
            <span>Job Discovery</span>
          </a>
          <a href="#configure-interview" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
            <span>Configure Interview</span>
          </a>
          <a href="#coaching" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <AcademicCapIcon className="w-4 h-4 text-green-500" />
            <span>Coaching Sessions</span>
          </a>
          <a href="#practice-interview" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <MicrophoneIcon className="w-4 h-4 text-red-500" />
            <span>Practice Interview</span>
          </a>
          <a href="#feedback" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <ChartBarIcon className="w-4 h-4 text-amber-500" />
            <span>Review Feedback</span>
          </a>
          <a href="#troubleshooting" className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
            <WrenchScrewdriverIcon className="w-4 h-4 text-orange-500" />
            <span>Troubleshooting</span>
          </a>
        </div>
      </section>

      {/* Introduction */}
      <section id="introduction">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BookOpenIcon className="w-6 h-6 text-indigo-600" />
          Introduction
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-3">What is CoachMic?</h3>
            <p className="text-gray-600 text-sm mb-4">
              CoachMic is a voice-first interview coaching platform that helps you practice for job interviews.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>Realistic mock interviews</strong> with an AI interviewer</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>Personalized questions</strong> based on your resume</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>Instant feedback</strong> on your performance</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>STAR analysis</strong> for behavioral answers</span>
              </li>
            </ul>
          </div>

          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-3">Why Use CoachMic?</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-xl">🗣️</span>
                <div>
                  <p className="font-medium">Practice speaking out loud</p>
                  <p className="text-gray-500 text-xs">Real interviews require verbal articulation</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-medium">Get personalized questions</p>
                  <p className="text-gray-500 text-xs">Tailored to YOUR experience, not generic</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">📊</span>
                <div>
                  <p className="font-medium">Receive objective feedback</p>
                  <p className="text-gray-500 text-xs">AI analysis without bias</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-medium">No account required</p>
                  <p className="text-gray-500 text-xs">Start practicing immediately</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section id="getting-started">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ComputerDesktopIcon className="w-6 h-6 text-green-600" />
          Getting Started
        </h2>

        <div className="bg-white border rounded-lg p-5 mb-6">
          <h3 className="font-semibold text-lg mb-4">Prerequisites</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <span className="text-2xl mb-2 block">🌐</span>
              <p className="font-medium text-sm">Modern Browser</p>
              <p className="text-xs text-gray-500">Chrome recommended</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <span className="text-2xl mb-2 block">🎤</span>
              <p className="font-medium text-sm">Microphone</p>
              <p className="text-xs text-gray-500">Built-in or external</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <span className="text-2xl mb-2 block">🤫</span>
              <p className="font-medium text-sm">Quiet Space</p>
              <p className="text-xs text-gray-500">Reduces interference</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <span className="text-2xl mb-2 block">📄</span>
              <p className="font-medium text-sm">Resume (Optional)</p>
              <p className="text-xs text-gray-500">PDF or DOCX</p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            Time Estimates
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-2xl font-bold text-green-700">20-30 min</p>
              <p className="text-sm text-green-800 font-medium">Standard Session</p>
              <p className="text-xs text-green-600">Resume + Interview + Feedback</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-2xl font-bold text-purple-700">45-60 min</p>
              <p className="text-sm text-purple-800 font-medium">Full Experience</p>
              <p className="text-xs text-purple-600">All features + Coaching</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-2xl font-bold text-blue-700">5-7</p>
              <p className="text-sm text-blue-800 font-medium">Questions per Interview</p>
              <p className="text-xs text-blue-600">5-15 minutes of speaking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Resume Upload */}
      <section id="resume-upload">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <DocumentTextIcon className="w-6 h-6 text-blue-600" />
          Step 1: Resume Upload & Analysis
        </h2>

        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-3">Why Upload a Resume?</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>AI asks questions about YOUR experience</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>References your actual job titles & companies</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>More realistic practice experience</span>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-3">How to Upload</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 rounded">1</span>
                    <span>Click on the upload area or drag and drop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 rounded">2</span>
                    <span>Supported formats: <strong>PDF</strong> or <strong>DOCX</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 rounded">3</span>
                    <span>Maximum file size: <strong>5MB</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 rounded">4</span>
                    <span>Wait for "Resume uploaded successfully!"</span>
                  </li>
                </ol>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-sm text-gray-600 mb-2"><strong>Can I skip this step?</strong></p>
                <p className="text-sm text-gray-600">
                  Yes! Click "Skip for now" to use generic interview questions. However, personalized questions provide a more realistic experience.
                </p>
              </div>
            </div>
          </div>

          {/* Resume Analysis Features */}
          <details className="bg-white border rounded-lg group">
            <summary className="p-5 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-primary-600" />
                Enhanced Resume Analysis (Click to expand)
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-5 pb-5 border-t">
              <p className="text-sm text-gray-600 my-4">
                After uploading, switch to the <strong>Analysis</strong> tab to see AI-powered insights:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h4 className="font-medium text-indigo-900 mb-2 flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4" />
                    Career Signals
                  </h4>
                  <ul className="text-sm text-indigo-800 space-y-1">
                    <li>• <strong>Seniority</strong>: Junior → Executive</li>
                    <li>• <strong>Industry Expertise</strong>: Primary industries</li>
                    <li>• <strong>Role Trajectory</strong>: IC vs Leadership</li>
                    <li>• <strong>Specializations</strong>: Core competencies</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    Skill Graph
                  </h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• <strong>Technical Skills</strong>: Tools, languages</li>
                    <li>• <strong>Domain Expertise</strong>: Industry knowledge</li>
                    <li>• <strong>Soft Skills</strong>: Leadership, communication</li>
                    <li>• Proficiency levels based on context</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                    <StarIcon className="w-4 h-4" />
                    STAR Stories
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Auto-extracted from your resume</li>
                    <li>• 3-5 complete STAR examples</li>
                    <li>• Interview-ready answers</li>
                    <li>• Review before practicing!</li>
                  </ul>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    Talking Points
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Quantified achievements</li>
                    <li>• Leadership accomplishments</li>
                    <li>• Technical innovations</li>
                    <li>• Collaboration examples</li>
                  </ul>
                </div>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* Job Discovery */}
      <section id="job-discovery">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BriefcaseIcon className="w-6 h-6 text-purple-600" />
          Step 2: Job Discovery (Optional)
        </h2>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-4">
          <p className="text-purple-800 text-sm">
            <strong>Location:</strong> Setup screen → "Discover Jobs For You" panel
          </p>
          <p className="text-purple-700 text-sm mt-2">
            Explore real job opportunities matched to your resume before configuring your interview.
          </p>
        </div>

        <div className="space-y-4">
          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>How Job Discovery Works</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-medium text-gray-900">1. Automatic Matching</p>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• AI analyzes your skills, experience, and industry</li>
                    <li>• Searches real job boards for relevant openings</li>
                    <li>• Returns 5-10 best-fit positions ranked by match score</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-900">2. Search Filters</p>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• <strong>Keywords</strong>: Technologies, roles, companies</li>
                    <li>• <strong>Location</strong>: City, state, or remote-only</li>
                    <li>• <strong>Job Level</strong>: Entry → Executive</li>
                  </ul>
                </div>
              </div>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>Understanding Job Cards</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <div className="mt-3 grid sm:grid-cols-2 gap-4">
                <ul className="space-y-1">
                  <li>• Company Name & Logo</li>
                  <li>• Job Title (clickable link)</li>
                  <li>• Location (on-site/remote/hybrid)</li>
                  <li>• Salary Range (when available)</li>
                </ul>
                <ul className="space-y-1">
                  <li>• <strong>Match Score</strong> (0-100%)</li>
                  <li>• ✅ Matched Skills</li>
                  <li>• ✨ Growth Opportunities</li>
                  <li>• 👍 Your Standout Strengths</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* Configure Interview */}
      <section id="configure-interview">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Cog6ToothIcon className="w-6 h-6 text-gray-600" />
          Step 3: Configure Your Interview
        </h2>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Setting</th>
                <th className="px-4 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-left font-semibold">Required?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 font-medium">Target Role</td>
                <td className="px-4 py-3 text-gray-600">Job title you're interviewing for (e.g., "Senior Frontend Developer")</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Required</span></td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Target Company</td>
                <td className="px-4 py-3 text-gray-600">
                  Enables AI research for company-specific questions and culture fit
                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">+AI Research</span>
                </td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Optional</span></td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Interview Type</td>
                <td className="px-4 py-3 text-gray-600">Behavioral, Technical, or Mixed</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Required</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Behavioral</h4>
            <p className="text-sm text-blue-700">STAR method questions about past experiences. Best for most interviews and HR rounds.</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">Technical</h4>
            <p className="text-sm text-purple-700">Role-specific technical knowledge. Best for engineering, IT, specialized roles.</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Mixed</h4>
            <p className="text-sm text-green-700">Combination of both types. Best for comprehensive practice.</p>
          </div>
        </div>

        {/* Company Intelligence Feature */}
        <details className="bg-indigo-50 border border-indigo-200 rounded-lg group mt-6">
          <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-indigo-100">
            <span className="flex items-center gap-2">
              <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
              Company Intelligence (Click to expand)
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">NEW</span>
            </span>
            <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="px-4 pb-4 border-t border-indigo-200">
            <div className="mt-3 space-y-3">
              <p className="text-sm text-indigo-800">
                When you specify a target company, CoachMic's AI researches it in real-time:
              </p>
              <ul className="text-sm text-indigo-700 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-indigo-500" />
                  <span><strong>Company values</strong> - Mission, culture, what they look for</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-indigo-500" />
                  <span><strong>Interview style</strong> - Known question patterns and expectations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-indigo-500" />
                  <span><strong>Industry context</strong> - Relevant trends and challenges</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-indigo-500" />
                  <span><strong>Role alignment</strong> - How your experience fits their needs</span>
                </li>
              </ul>
              <div className="p-3 bg-white rounded border border-indigo-200 mt-3">
                <p className="text-xs text-indigo-600">
                  <strong>How it works:</strong> When you start the interview, the AI spends a few seconds researching the company
                  before generating tailored questions. This makes the practice more realistic for your actual interview.
                </p>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* Coaching */}
      <section id="coaching">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <AcademicCapIcon className="w-6 h-6 text-green-600" />
          Step 4 & 7: Coaching Sessions
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Pre-Interview Coaching */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-3 text-green-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">Pre</span>
              Pre-Interview Coaching
            </h3>
            <p className="text-sm text-green-800 mb-3">
              <strong>When:</strong> BEFORE starting your voice interview
            </p>
            <ul className="text-sm text-green-700 space-y-2">
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Preview likely questions for your role</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Refine your STAR-method answers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Build confidence before realistic practice</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Choose Text or Voice mode</span>
              </li>
            </ul>
            <div className="mt-4 p-3 bg-white rounded border border-green-200">
              <p className="text-xs text-green-700">
                <strong>Best for:</strong> First-time users or important interview prep
              </p>
            </div>
          </div>

          {/* Post-Interview Coaching */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-3 text-purple-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm">Post</span>
              Post-Interview Coaching
            </h3>
            <p className="text-sm text-purple-800 mb-3">
              <strong>When:</strong> AFTER reviewing your feedback
            </p>
            <ul className="text-sm text-purple-700 space-y-2">
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Reviews YOUR specific transcript</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Re-practice your weakest questions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Get actionable improvement strategies</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Track progress over time</span>
              </li>
            </ul>
            <div className="mt-4 p-3 bg-white rounded border border-purple-200">
              <p className="text-xs text-purple-700">
                <strong>Best for:</strong> Score &lt; 70 or real interview coming soon
              </p>
            </div>
          </div>
        </div>

        <details className="bg-white border rounded-lg group mt-4">
          <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
            <span>Coaching Session Structure (Click to expand)</span>
            <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="px-4 pb-4 border-t text-sm">
            <div className="mt-3 grid sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900 mb-2">Phase 1: Review (5 min)</p>
                <ul className="text-gray-600 space-y-1 text-xs">
                  <li>• Previews likely questions</li>
                  <li>• Discusses experiences to highlight</li>
                  <li>• Selects strongest STAR stories</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900 mb-2">Phase 2: Practice (10-15 min)</p>
                <ul className="text-gray-600 space-y-1 text-xs">
                  <li>• Practice 2-3 key questions</li>
                  <li>• Real-time feedback on answers</li>
                  <li>• STAR method refinement</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900 mb-2">Phase 3: Next Steps (5 min)</p>
                <ul className="text-gray-600 space-y-1 text-xs">
                  <li>• Actionable improvement plan</li>
                  <li>• Recommended focus areas</li>
                  <li>• When to practice again</li>
                </ul>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* Practice Interview */}
      <section id="practice-interview">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <MicrophoneIcon className="w-6 h-6 text-red-600" />
          Step 5: Practice Your Interview
        </h2>

        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4">During the Interview</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="font-medium text-gray-900 mb-2">Interface Elements:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <span><strong>Timer</strong> - Elapsed time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0"></span>
                    <span><strong>Green dot</strong> - AI is listening</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <SpeakerWaveIcon className="w-4 h-4 text-gray-400" />
                    <span><strong>Sound wave</strong> - AI is speaking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-yellow-500 rounded-full flex-shrink-0"></span>
                    <span><strong>Yellow dot</strong> - Connecting</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">How It Works:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>1. AI greets you and asks the first question</li>
                  <li>2. Speak naturally - just like a real interview</li>
                  <li>3. AI waits for you to finish before responding</li>
                  <li>4. Expect 5-7 questions total (5-15 minutes)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                <CheckIcon className="w-5 h-5" />
                Do This
              </h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✓ Speak clearly into your microphone</li>
                <li>✓ Take a moment to think before answering</li>
                <li>✓ Use the STAR method for behavioral questions</li>
                <li>✓ Be specific with examples</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                <LightBulbIcon className="w-5 h-5" />
                Tips
              </h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>💡 Use headphones for better audio</li>
                <li>💡 It's okay to pause and think (2-5 seconds)</li>
                <li>💡 Keep answers to 1-2 minutes</li>
                <li>💡 Click "End Interview" when done</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ChartBarIcon className="w-6 h-6 text-amber-600" />
          Step 6: Review Your Feedback
        </h2>

        <div className="space-y-4">
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold">Score Interpretation</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Score</th>
                  <th className="px-4 py-2 text-left">Meaning</th>
                  <th className="px-4 py-2 text-left">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 font-medium text-green-700">80-100</td>
                  <td className="px-4 py-2 text-gray-600">Excellent</td>
                  <td className="px-4 py-2 text-gray-600">You're well-prepared!</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium text-amber-700">60-79</td>
                  <td className="px-4 py-2 text-gray-600">Good</td>
                  <td className="px-4 py-2 text-gray-600">Some areas to refine</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium text-red-700">Below 60</td>
                  <td className="px-4 py-2 text-gray-600">Needs Work</td>
                  <td className="px-4 py-2 text-gray-600">Focus on improvement areas</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Feedback Categories</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span><strong>Content</strong> - Quality and relevance</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span><strong>Delivery</strong> - How well you communicated</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                  <span><strong>Structure</strong> - Organization of responses</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span><strong>Relevance</strong> - How well you addressed questions</span>
                </li>
              </ul>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Speaking Metrics</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>Words per Minute</strong> - Target: 120-150 WPM</li>
                <li><strong>Filler Words</strong> - "Um," "uh," "like" - fewer is better</li>
                <li><strong>Response Time</strong> - 2-5 seconds is natural</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section id="troubleshooting">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-6 h-6 text-orange-600" />
          Troubleshooting
        </h2>

        <div className="space-y-3">
          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                Microphone access denied
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <ol className="mt-3 space-y-1">
                <li>1. Click the lock icon in your browser's address bar</li>
                <li>2. Find "Microphone" in the permissions list</li>
                <li>3. Change the setting to "Allow"</li>
                <li>4. Refresh the page</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                AI can't hear me
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <ol className="mt-3 space-y-1">
                <li>1. Check if your microphone is muted at system level</li>
                <li>2. Ensure no other apps are using the microphone</li>
                <li>3. Try a different browser (Chrome works best)</li>
                <li>4. Test your microphone in system settings</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
                Disconnected status
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <ol className="mt-3 space-y-1">
                <li>1. Check your internet connection</li>
                <li>2. Refresh the page and try again</li>
                <li>3. Disable VPN if using one</li>
                <li>4. Try a different browser</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-blue-500" />
                Can't hear the AI interviewer
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <ol className="mt-3 space-y-1">
                <li>1. Check your device volume</li>
                <li>2. Ensure speakers/headphones are connected</li>
                <li>3. Check browser tab isn't muted (speaker icon in tab)</li>
              </ol>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-purple-500" />
                Resume upload issues
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t text-sm text-gray-600">
              <div className="mt-3 space-y-2">
                <p><strong>"File too large":</strong> Compress your PDF or reduce image quality. Max: 5MB</p>
                <p><strong>"Invalid file type":</strong> Only PDF and DOCX are supported. Convert if needed.</p>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <QuestionMarkCircleIcon className="w-6 h-6 text-gray-600" />
          Frequently Asked Questions
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">Do I need to create an account?</h4>
            <p className="text-sm text-gray-600">No! CoachMic works without any account or sign-up.</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">Is my data stored?</h4>
            <p className="text-sm text-gray-600">Session data is stored temporarily in your browser. No permanent server storage.</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">How long is each session?</h4>
            <p className="text-sm text-gray-600">Typically 5-15 minutes with 5-7 questions.</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">Can I practice multiple times?</h4>
            <p className="text-sm text-gray-600">Yes! Click "Practice Again" after reviewing feedback.</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">Are questions the same every time?</h4>
            <p className="text-sm text-gray-600">No, questions are dynamically generated based on your resume and target role.</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">Which browsers are supported?</h4>
            <p className="text-sm text-gray-600">Chrome (recommended), Firefox, Safari, and Edge.</p>
          </div>
        </div>
      </section>

      {/* Browser Requirements */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ComputerDesktopIcon className="w-6 h-6 text-gray-600" />
          Browser Requirements
        </h2>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Browser</th>
                <th className="px-4 py-2 text-left">Version</th>
                <th className="px-4 py-2 text-left">Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="bg-green-50">
                <td className="px-4 py-2 font-medium">Chrome</td>
                <td className="px-4 py-2">90+</td>
                <td className="px-4 py-2"><span className="px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs">Recommended</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Firefox</td>
                <td className="px-4 py-2">90+</td>
                <td className="px-4 py-2 text-gray-600">Full</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Safari</td>
                <td className="px-4 py-2">15+</td>
                <td className="px-4 py-2 text-gray-600">Full</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Edge</td>
                <td className="px-4 py-2">90+</td>
                <td className="px-4 py-2 text-gray-600">Full</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Ready to Start Practicing?</h2>
        <p className="text-indigo-100 mb-6">
          Your voice is your superpower. Land the job.
        </p>
        <a 
          href="/"
          className="inline-block bg-white text-indigo-600 font-semibold px-8 py-3 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          Start Free Practice →
        </a>
        <p className="text-indigo-200 text-sm mt-4">
          Built for the Google Cloud AI Partner Catalyst Hackathon
        </p>
      </section>
    </div>
  );
}
