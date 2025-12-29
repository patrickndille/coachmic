import { 
  StarIcon, 
  CheckIcon,
  LightBulbIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';

export function StarMethodContent() {
  return (
    <div className="space-y-8">
      {/* Hero Introduction */}
      <section className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-6 border border-yellow-100">
        <div className="flex items-start gap-4">
          <div className="bg-white p-3 rounded-full shadow-sm">
            <StarIcon className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">The STAR Method</h2>
            <p className="text-gray-700">
              Master the gold standard framework for answering behavioral interview questions. 
              CoachMic analyzes your responses for STAR components to help you improve.
            </p>
          </div>
        </div>
      </section>

      {/* What is STAR */}
      <section className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">What is STAR?</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-3xl font-bold text-blue-700">S</p>
            <p className="font-semibold text-blue-900">Situation</p>
            <p className="text-xs text-blue-600 mt-1">Set the scene</p>
            <p className="text-xs text-blue-500 mt-2 font-medium">15-20% of answer</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-3xl font-bold text-purple-700">T</p>
            <p className="font-semibold text-purple-900">Task</p>
            <p className="text-xs text-purple-600 mt-1">Your responsibility</p>
            <p className="text-xs text-purple-500 mt-2 font-medium">10-15% of answer</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-3xl font-bold text-green-700">A</p>
            <p className="font-semibold text-green-900">Action</p>
            <p className="text-xs text-green-600 mt-1">What YOU did</p>
            <p className="text-xs text-green-500 mt-2 font-medium">50-60% of answer</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-3xl font-bold text-amber-700">R</p>
            <p className="font-semibold text-amber-900">Result</p>
            <p className="text-xs text-amber-600 mt-1">Outcome & impact</p>
            <p className="text-xs text-amber-500 mt-2 font-medium">15-20% of answer</p>
          </div>
        </div>
      </section>

      {/* Breaking Down Each Component */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <DocumentTextIcon className="w-6 h-6 text-primary-600" />
          Breaking Down Each Component
        </h2>

        <div className="space-y-6">
          {/* Situation */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-blue-500 text-white p-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-8 bg-white text-blue-500 rounded-full flex items-center justify-center font-bold">S</span>
                Situation
                <span className="ml-auto text-blue-100 text-sm font-normal">15-20% of your answer</span>
              </h3>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">Set the scene and provide context for your story.</p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-medium text-gray-900 mb-2">What to include:</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-500" /> Where were you working?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-500" /> What was the project/challenge?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-500" /> When did this happen?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-blue-500" /> Who was involved?</li>
                  </ul>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-2">Example:</p>
                  <p className="text-sm text-blue-800 italic">
                    "At my previous company, we were launching a new product feature. Two weeks before the deadline, our lead developer resigned unexpectedly, leaving the project at risk."
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <LightBulbIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span><strong>Tip:</strong> Keep it brief—don't over-explain. Choose situations that showcase your skills.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Task */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-purple-500 text-white p-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-8 bg-white text-purple-500 rounded-full flex items-center justify-center font-bold">T</span>
                Task
                <span className="ml-auto text-purple-100 text-sm font-normal">10-15% of your answer</span>
              </h3>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">Explain YOUR specific responsibility in this situation.</p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-medium text-gray-900 mb-2">What to include:</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-purple-500" /> What was your role?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-purple-500" /> What were you specifically responsible for?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-purple-500" /> What was expected of you?</li>
                  </ul>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm font-medium text-purple-900 mb-2">Example:</p>
                  <p className="text-sm text-purple-800 italic">
                    "As the senior engineer on the team, I was tasked with taking over project leadership, redistributing the work, and ensuring we met our deadline."
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <LightBulbIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span><strong>Tip:</strong> Focus on YOUR task, not the team's. Don't confuse Task with Situation.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-green-500 text-white p-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-8 bg-white text-green-500 rounded-full flex items-center justify-center font-bold">A</span>
                Action
                <span className="ml-auto text-green-100 text-sm font-normal">50-60% of your answer ⭐ Most Important!</span>
              </h3>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">Describe the specific steps YOU took to address the situation.</p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-medium text-gray-900 mb-2">What to include:</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-500" /> What did you specifically do?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-500" /> How did you approach the problem?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-500" /> What decisions did you make?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-green-500" /> How did you handle challenges?</li>
                  </ul>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm font-medium text-green-900 mb-2">Example:</p>
                  <p className="text-sm text-green-800 italic">
                    "First, I conducted a code review to understand the project status. Then I created a detailed task breakdown and reassigned work based on team members' strengths. I implemented daily standups to track progress and personally took on the most critical components."
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <LightBulbIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span><strong>Tip:</strong> Use "I" statements, not "we". This is the most important part—spend time here!</span>
                </p>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-amber-500 text-white p-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-8 bg-white text-amber-500 rounded-full flex items-center justify-center font-bold">R</span>
                Result
                <span className="ml-auto text-amber-100 text-sm font-normal">15-20% of your answer</span>
              </h3>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-4">Share the outcome and impact of your actions.</p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-medium text-gray-900 mb-2">What to include:</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-amber-500" /> What was the outcome?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-amber-500" /> Did you meet your goal?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-amber-500" /> What was the quantifiable impact?</li>
                    <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-amber-500" /> What did you learn?</li>
                  </ul>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <p className="text-sm font-medium text-amber-900 mb-2">Example:</p>
                  <p className="text-sm text-amber-800 italic">
                    "We delivered the feature on time, resulting in a 25% increase in user engagement within the first month. I also documented the process, which became our team's standard for handling similar situations."
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <LightBulbIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span><strong>Tip:</strong> Quantify results when possible (numbers, percentages). Include what you learned!</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Complete Example */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary-600" />
          Complete STAR Example
        </h2>

        <div className="bg-gray-900 rounded-lg p-6 text-white">
          <div className="mb-4 pb-4 border-b border-gray-700">
            <p className="text-gray-400 text-sm">Question:</p>
            <p className="text-lg font-medium">"Tell me about a time you had to meet a tight deadline."</p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-400">
              <p className="text-blue-300 text-sm font-semibold mb-1">[SITUATION]</p>
              <p className="text-gray-200 text-sm">
                "Last year at TechCorp, our team was developing a payment integration for a major client. Three days before our deployment date, we discovered a critical security vulnerability that could expose customer data."
              </p>
            </div>

            <div className="bg-purple-900/30 rounded-lg p-4 border-l-4 border-purple-400">
              <p className="text-purple-300 text-sm font-semibold mb-1">[TASK]</p>
              <p className="text-gray-200 text-sm">
                "As the security lead, I was responsible for assessing the risk, developing a fix, and coordinating with the client to either patch the vulnerability or negotiate a new timeline."
              </p>
            </div>

            <div className="bg-green-900/30 rounded-lg p-4 border-l-4 border-green-400">
              <p className="text-green-300 text-sm font-semibold mb-1">[ACTION]</p>
              <p className="text-gray-200 text-sm">
                "I immediately assembled a tiger team of two developers and myself. I performed a thorough security audit to understand the full scope of the vulnerability. Then I designed a two-phase fix: a temporary patch that could be deployed within 24 hours, and a comprehensive solution for the following week. I personally wrote the critical security code and conducted code reviews for the team's contributions."
              </p>
            </div>

            <div className="bg-amber-900/30 rounded-lg p-4 border-l-4 border-amber-400">
              <p className="text-amber-300 text-sm font-semibold mb-1">[RESULT]</p>
              <p className="text-gray-200 text-sm">
                "We deployed the temporary patch within 18 hours, and the client chose to proceed with the original launch date. The client was so impressed with our handling of the situation that they expanded their contract by 40%. The incident also led me to implement mandatory security audits in our development process, reducing similar issues by 80% in the following year."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Common Questions by Category */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary-600" />
          Common Behavioral Questions
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span>🎯 Leadership</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t">
              <ul className="text-sm text-gray-600 space-y-2 mt-3">
                <li>• Tell me about a time you led a team through a difficult project.</li>
                <li>• Describe a situation where you had to motivate underperforming team members.</li>
                <li>• Give an example of when you had to make an unpopular decision.</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span>🧩 Problem-Solving</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t">
              <ul className="text-sm text-gray-600 space-y-2 mt-3">
                <li>• Tell me about a complex problem you solved.</li>
                <li>• Describe a time you had to make a decision with incomplete information.</li>
                <li>• Give an example of when you identified a problem before it became critical.</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span>🤝 Teamwork</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t">
              <ul className="text-sm text-gray-600 space-y-2 mt-3">
                <li>• Tell me about a time you worked with a difficult colleague.</li>
                <li>• Describe how you handle disagreements with team members.</li>
                <li>• Give an example of successful collaboration with another department.</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span>📚 Failure & Learning</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t">
              <ul className="text-sm text-gray-600 space-y-2 mt-3">
                <li>• Tell me about a time you failed.</li>
                <li>• Describe a mistake you made and how you handled it.</li>
                <li>• Give an example of receiving critical feedback.</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span>⏰ Time Management</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t">
              <ul className="text-sm text-gray-600 space-y-2 mt-3">
                <li>• Tell me about a time you had to meet a tight deadline.</li>
                <li>• Describe how you prioritize competing demands.</li>
                <li>• Give an example of when you had to manage multiple projects.</li>
              </ul>
            </div>
          </details>

          <details className="bg-white border rounded-lg group">
            <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-gray-50">
              <span>💡 Initiative & Growth</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 border-t">
              <ul className="text-sm text-gray-600 space-y-2 mt-3">
                <li>• Tell me about a time you went above and beyond.</li>
                <li>• Describe when you learned a new skill quickly.</li>
                <li>• Give an example of influencing without authority.</li>
              </ul>
            </div>
          </details>
        </div>
      </section>

      {/* How CoachMic Analyzes */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ChartBarIcon className="w-6 h-6 text-primary-600" />
          How CoachMic Analyzes Your STAR Responses
        </h2>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Component</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">What We Check</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">If "Not Detected"</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 font-medium text-blue-700">Situation</td>
                <td className="px-4 py-3 text-sm text-gray-600">Did you provide clear context?</td>
                <td className="px-4 py-3 text-sm text-gray-600">Add context at the beginning</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-purple-700">Task</td>
                <td className="px-4 py-3 text-sm text-gray-600">Did you explain your specific role?</td>
                <td className="px-4 py-3 text-sm text-gray-600">Clarify YOUR specific responsibility</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-green-700">Action</td>
                <td className="px-4 py-3 text-sm text-gray-600">Did you describe concrete steps YOU took?</td>
                <td className="px-4 py-3 text-sm text-gray-600">Use more "I" statements with specific steps</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-amber-700">Result</td>
                <td className="px-4 py-3 text-sm text-gray-600">Did you share measurable outcomes?</td>
                <td className="px-4 py-3 text-sm text-gray-600">End with outcomes and numbers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* CoachMic STAR Extraction */}
      <section className="bg-primary-50 border border-primary-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ArrowPathIcon className="w-6 h-6 text-primary-600" />
          CoachMic: Automatic STAR Story Extraction
        </h2>
        
        <p className="text-gray-700 mb-4">
          <strong>Time-Saver Feature:</strong> When you upload your resume, CoachMic automatically extracts 3-5 complete STAR stories from your work experiences.
        </p>

        <div className="bg-white rounded-lg p-4 border mb-4">
          <p className="font-medium text-gray-900 mb-2">📍 Where to Find:</p>
          <p className="text-gray-600 text-sm">
            Setup screen → Upload Resume → <strong>Analysis Tab</strong> → <strong>STAR Stories</strong> section
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="font-medium text-gray-900 mb-2">What You'll See:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-primary-600" /> Situation: Background and context</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-primary-600" /> Task: Your specific responsibility</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-primary-600" /> Action: Steps you took</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-primary-600" /> Result: Outcomes and metrics</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-2">How to Use:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-start gap-2"><span className="font-mono text-xs bg-primary-100 px-1.5 rounded">1</span> Review extracted stories before your interview</li>
              <li className="flex items-start gap-2"><span className="font-mono text-xs bg-primary-100 px-1.5 rounded">2</span> Verify accuracy (double-check numbers)</li>
              <li className="flex items-start gap-2"><span className="font-mono text-xs bg-primary-100 px-1.5 rounded">3</span> Memorize 2-3 strongest stories</li>
              <li className="flex items-start gap-2"><span className="font-mono text-xs bg-primary-100 px-1.5 rounded">4</span> Reference during Pre-Interview Coaching</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Do's and Don'ts */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Pro Tips</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-green-800">
              <CheckIcon className="w-6 h-6" />
              Do This
            </h3>
            <ul className="space-y-2 text-sm text-green-900">
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Prepare 5-7 STAR stories covering multiple competencies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Practice timing (aim for 2-3 minutes per answer)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Use recent examples (last 2-3 years if possible)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Quantify results whenever possible</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Include lessons learned</span>
              </li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-5">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-red-800">
              <span className="text-xl">✗</span>
              Avoid This
            </h3>
            <ul className="space-y-2 text-sm text-red-900">
              <li className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span>Don't ramble—keep each component focused</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span>Don't use "we" when you mean "I"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span>Don't choose examples where you were passive</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span>Don't skip the Result—it's crucial</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span>Don't badmouth previous employers</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Practice Checklist */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Practice Checklist</h2>
        <p className="text-gray-600 mb-4">Before your interview, ensure you have STAR stories for:</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A leadership challenge</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A conflict resolution</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A failure and what you learned</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A tight deadline you met</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A time you went above and beyond</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A difficult decision you made</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">A successful collaboration</span>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
            <span className="w-6 h-6 border-2 border-gray-300 rounded flex-shrink-0"></span>
            <span className="text-gray-700 text-sm">Influencing without authority</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Ready to Practice Your STAR Responses?</h2>
        <p className="text-yellow-100 mb-6">
          Use CoachMic to practice and get instant AI feedback on your STAR method delivery.
        </p>
        <a 
          href="/"
          className="inline-block bg-white text-amber-600 font-semibold px-8 py-3 rounded-lg hover:bg-amber-50 transition-colors"
        >
          Start Practicing →
        </a>
      </section>
    </div>
  );
}
