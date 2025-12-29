import { JobMatch } from '../../types';
import {
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BookOpenIcon,
  UserGroupIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface ApplicationTipsTabProps {
  job: JobMatch;
}

export function ApplicationTipsTab({ job }: ApplicationTipsTabProps) {
  // Generate tips based on job and fit analysis
  const tips = generateTips(job);

  return (
    <div className="p-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <LightBulbIcon className="w-5 h-5 text-amber-500" />
          Application Tips
        </h3>
        <p className="text-sm text-gray-600">
          Personalized tips to help you stand out when applying for this role.
        </p>
      </div>

      {/* Key Tips */}
      <div className="space-y-4">
        {tips.map((tip, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg border ${
              tip.type === 'success'
                ? 'bg-green-50 border-green-200'
                : tip.type === 'warning'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-1.5 rounded-full ${
                  tip.type === 'success'
                    ? 'bg-green-100'
                    : tip.type === 'warning'
                    ? 'bg-amber-100'
                    : 'bg-blue-100'
                }`}
              >
                {tip.type === 'success' ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                ) : tip.type === 'warning' ? (
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
                ) : (
                  <LightBulbIcon className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div>
                <h4
                  className={`font-medium mb-1 ${
                    tip.type === 'success'
                      ? 'text-green-800'
                      : tip.type === 'warning'
                      ? 'text-amber-800'
                      : 'text-blue-800'
                  }`}
                >
                  {tip.title}
                </h4>
                <p
                  className={`text-sm ${
                    tip.type === 'success'
                      ? 'text-green-700'
                      : tip.type === 'warning'
                      ? 'text-amber-700'
                      : 'text-blue-700'
                  }`}
                >
                  {tip.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* General Tips Section */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">General Application Tips</h4>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <BookOpenIcon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-700 text-sm">Research the Company</p>
              <p className="text-sm text-gray-600">
                Look up {job.job.company}'s recent news, values, and culture before applying.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <UserGroupIcon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-700 text-sm">Connect on LinkedIn</p>
              <p className="text-sm text-gray-600">
                Find employees at {job.job.company} and send a thoughtful connection request.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ClockIcon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-700 text-sm">Apply Early</p>
              <p className="text-sm text-gray-600">
                Applications submitted early often get more attention from recruiters.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interview Prep Reminder */}
      <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
        <h4 className="font-medium text-primary-800 mb-2">🎤 Prepare for the Interview</h4>
        <p className="text-sm text-primary-700">
          Use the "Practice Interview" button to prepare for {job.job.title} questions
          with our AI interviewer.
        </p>
      </div>
    </div>
  );
}

interface Tip {
  type: 'success' | 'warning' | 'info';
  title: string;
  content: string;
}

function generateTips(job: JobMatch): Tip[] {
  const tips: Tip[] = [];

  // Add tips based on fit analysis
  if (job.fitAnalysis) {
    // Highlight strengths
    if (job.fitAnalysis.strengthsForRole?.length > 0) {
      tips.push({
        type: 'success',
        title: 'Highlight Your Strengths',
        content: `Emphasize your ${job.fitAnalysis.strengthsForRole[0].toLowerCase()} in your cover letter and interview.`,
      });
    }

    // Address concerns
    if (job.fitAnalysis.potentialConcerns?.length > 0) {
      tips.push({
        type: 'warning',
        title: 'Address Potential Gaps',
        content: `Be prepared to discuss: ${job.fitAnalysis.potentialConcerns[0]}. Show how you're working to improve in this area.`,
      });
    }

    // Match score tips
    const matchScore = job.fitAnalysis.overallMatch || 0;
    if (matchScore >= 80) {
      tips.push({
        type: 'success',
        title: 'Strong Match!',
        content: 'Your profile is a great fit. Focus on showcasing specific achievements that align with the role.',
      });
    } else if (matchScore >= 60) {
      tips.push({
        type: 'info',
        title: 'Good Match',
        content: 'You have a solid foundation. Highlight transferable skills and relevant experiences.',
      });
    } else if (matchScore > 0) {
      tips.push({
        type: 'warning',
        title: 'Growth Opportunity',
        content: 'Focus on demonstrating your learning ability and passion for growing into this role.',
      });
    }
  }

  // Add role-specific tips
  const roleTitle = job.job.title.toLowerCase();
  
  if (roleTitle.includes('senior') || roleTitle.includes('lead')) {
    tips.push({
      type: 'info',
      title: 'Leadership Experience',
      content: 'Highlight examples of mentoring, leading projects, or driving team outcomes.',
    });
  }

  if (roleTitle.includes('remote') || job.job.remoteType === 'remote') {
    tips.push({
      type: 'info',
      title: 'Remote Work',
      content: 'Mention your experience with remote collaboration tools and self-management.',
    });
  }

  // Default tips if none generated
  if (tips.length === 0) {
    tips.push({
      type: 'info',
      title: 'Tailor Your Application',
      content: `Customize your cover letter specifically for the ${job.job.title} role at ${job.job.company}.`,
    });
  }

  return tips;
}
