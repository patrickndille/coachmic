import {
  RocketLaunchIcon,
  ClockIcon,
  CheckIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  SparklesIcon,
  ArrowPathIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/solid';

export function QuickStartContent() {
  return (
    <div className="space-y-8">
      {/* Hero Introduction */}
      <section className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-6 border border-primary-100">
        <div className="flex items-start gap-4">
          <div className="bg-white p-3 rounded-full shadow-sm">
            <RocketLaunchIcon className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Get Started in 5 Minutes</h2>
            <p className="text-gray-700">
              Start practicing for your interviews right away. No account required—just follow these simple steps 
              and get instant AI feedback on your answers.
            </p>
          </div>
        </div>
      </section>

      {/* Time Estimate */}
      <section className="bg-white border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-gray-600" />
          Time Estimates
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-2xl font-bold text-green-700">5 min</p>
            <p className="text-sm text-green-800">Quick Practice</p>
            <p className="text-xs text-green-600 mt-1">Skip resume, generic questions</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-2xl font-bold text-blue-700">15 min</p>
            <p className="text-sm text-blue-800">Standard Session</p>
            <p className="text-xs text-blue-600 mt-1">With resume upload</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <p className="text-2xl font-bold text-purple-700">30 min</p>
            <p className="text-sm text-purple-800">Full Experience</p>
            <p className="text-xs text-purple-600 mt-1">All features + coaching</p>
          </div>
        </div>
      </section>

      {/* Quick Start Steps */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary-600" />
          Quick Start Steps
        </h2>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">1</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Open CoachMic</h3>
                <p className="text-gray-600 text-sm">
                  Go to the homepage and click <strong>"Start Free Practice"</strong>. 
                  No account needed—just click and go!
                </p>
              </div>
              <div className="hidden sm:block">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">No signup</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">2</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                  Upload Your Resume
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-normal">Optional</span>
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  Drag and drop your PDF/DOCX resume for personalized questions based on YOUR experience.
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <DocumentTextIcon className="w-4 h-4" />
                  <span>PDF or DOCX • Max 5MB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional: Job Discovery */}
          <div className="ml-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <BriefcaseIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  Bonus: Discover Matched Jobs
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">2-3 min</span>
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  See real job opportunities that match your resume with AI-powered fit analysis.
                </p>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 px-1.5 rounded">1</span>
                    <span>Scroll to "Discover Jobs For You" on the setup screen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 px-1.5 rounded">2</span>
                    <span>Click "Search Jobs" to see AI-matched opportunities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 px-1.5 rounded">3</span>
                    <span>Click "Use This Role for Practice" on any job to auto-configure</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">3</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Configure Your Interview</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Tell us what role you're practicing for:
                </p>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 p-3 rounded border">
                    <p className="font-medium text-gray-900">Target Role</p>
                    <p className="text-gray-500 text-xs">e.g., "Software Engineer"</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <p className="font-medium text-gray-900">Company <span className="text-gray-400 font-normal">(optional)</span></p>
                    <p className="text-gray-500 text-xs">e.g., "Google"</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <p className="font-medium text-gray-900">Interview Type</p>
                    <p className="text-gray-500 text-xs">Behavioral, Technical, or Mixed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bonus: Company Intelligence */}
          <div className="ml-6 bg-indigo-50 border border-indigo-200 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <BuildingOfficeIcon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                  Bonus: Company Intelligence
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">NEW</span>
                </h4>
                <p className="text-sm text-indigo-800 mb-3">
                  When you enter a target company, CoachMic researches it in real-time to tailor your interview.
                </p>
                <ol className="text-sm text-indigo-700 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-indigo-100 px-1.5 rounded">1</span>
                    <span>Enter a company name (e.g., "Google", "Stripe")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-indigo-100 px-1.5 rounded">2</span>
                    <span>AI researches company culture, values, and interview style</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-indigo-100 px-1.5 rounded">3</span>
                    <span>Questions are tailored to what that company actually asks</span>
                  </li>
                </ol>
                <div className="mt-3 p-2 bg-white rounded border border-indigo-200">
                  <p className="text-xs text-indigo-600">
                    Works best with well-known companies. Generic questions used for smaller/unknown companies.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Optional: Pre-Interview Coaching */}
          <div className="ml-6 bg-green-50 border border-green-200 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  Bonus: Pre-Interview Coaching
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">5-15 min</span>
                </h4>
                <p className="text-sm text-green-800 mb-3">
                  Build confidence before the realistic interview with AI coaching.
                </p>
                <ul className="text-sm text-green-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Preview likely questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Refine your STAR-method answers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Choose text or voice coaching mode</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">4</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                  <MicrophoneIcon className="w-5 h-5 text-primary-600" />
                  Start Your Interview
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  Click "Start Interview", allow microphone access, and speak naturally. The AI interviewer will ask 5-7 questions.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs border border-amber-200">💡 Use headphones</span>
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs border border-amber-200">💡 Find a quiet space</span>
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs border border-amber-200">💡 Speak clearly</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">5</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-primary-600" />
                  Get Your Feedback
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  Click "End Interview" when done. Review your personalized feedback:
                </p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    <span>Overall performance score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    <span>Per-question analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    <span>STAR method breakdown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    <span>Improvement suggestions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optional: Post-Interview Coaching */}
          <div className="ml-6 bg-purple-50 border border-purple-200 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <ArrowPathIcon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                  Bonus: Post-Interview Coaching
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">10-15 min</span>
                </h4>
                <p className="text-sm text-purple-800 mb-3">
                  Improve your weak areas with personalized coaching based on YOUR performance.
                </p>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Re-practice your weakest questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Get actionable improvement strategies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Compare scores over time</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pro Tips */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <LightBulbIcon className="w-6 h-6 text-amber-500" />
          Pro Tips for Success
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xl">🎧</span>
            <div>
              <p className="font-medium text-gray-900">Use headphones</p>
              <p className="text-sm text-gray-600">Better audio quality for voice interviews</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xl">🤫</span>
            <div>
              <p className="font-medium text-gray-900">Find a quiet space</p>
              <p className="text-sm text-gray-600">Background noise affects accuracy</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xl">⭐</span>
            <div>
              <p className="font-medium text-gray-900">Use the STAR method</p>
              <p className="text-sm text-gray-600">Situation, Task, Action, Result</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">Track your progress</p>
              <p className="text-sm text-gray-600">Practice weekly to build lasting skills</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xl">🎯</span>
            <div>
              <p className="font-medium text-gray-900">Be specific</p>
              <p className="text-sm text-gray-600">Use real examples with numbers</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xl">🌐</span>
            <div>
              <p className="font-medium text-gray-900">Use Chrome browser</p>
              <p className="text-sm text-gray-600">Best compatibility with voice features</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <QuestionMarkCircleIcon className="w-6 h-6 text-gray-600" />
          Common Questions
        </h2>

        <div className="space-y-3">
          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>How long is the interview?</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              5-15 minutes depending on how detailed your answers are. The AI will ask 5-7 questions.
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>Do I need to create an account?</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              No! You can start practicing immediately without signing up. Create an account later to save your history and track progress.
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>What if the AI can't hear me?</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              Check your browser's microphone permissions. Click the lock icon in the address bar and ensure microphone access is allowed for this site.
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-medium flex items-center justify-between hover:bg-gray-50">
              <span>Is my data private?</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">
              Yes! Your resume and interview recordings are processed securely and not shared. We use industry-standard encryption.
            </div>
          </details>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Ready to Start?</h2>
        <p className="text-primary-100 mb-6">
          Your next interview could be the one. Be prepared.
        </p>
        <a 
          href="/"
          className="inline-block bg-white text-primary-600 font-semibold px-8 py-3 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Start Free Practice →
        </a>
      </section>
    </div>
  );
}
