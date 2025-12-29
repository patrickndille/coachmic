import { ATSAnalysis } from '../../types';
import { CheckCircleIcon, ExclamationTriangleIcon, LightBulbIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface ATSFeedbackPanelProps {
  atsAnalysis: ATSAnalysis;
}

export function ATSFeedbackPanel({ atsAnalysis }: ATSFeedbackPanelProps) {
  const { atsScore, scoreBreakdown, atsIssues, keywordGaps, formattingTips, industryKeywords } = atsAnalysis;

  // Determine score color and label
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Overall ATS Score */}
      <div className={`rounded-lg border-2 ${getScoreBgColor(atsScore)} p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              ATS Optimization Score
            </h3>
            <p className="text-sm text-gray-600">
              How well your resume works with Applicant Tracking Systems
            </p>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(atsScore)}`}>
              {atsScore}
            </div>
            <div className={`text-sm font-medium ${getScoreColor(atsScore)}`}>
              {getScoreLabel(atsScore)}
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(scoreBreakdown).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-2xl font-bold text-gray-700">{value}</div>
              <div className="text-xs text-gray-600">
                {key
                  .replace(/_/g, ' ')
                  .replace(/([A-Z])/g, ' $1')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')
                  .trim()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ATS Issues */}
        {atsIssues.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
              <h4 className="font-semibold text-gray-900">Issues to Fix</h4>
            </div>
            <ul className="space-y-3">
              {atsIssues.map((issueItem, index) => {
                const severityColor = issueItem.severity === 'high'
                  ? 'text-red-500'
                  : issueItem.severity === 'medium'
                    ? 'text-orange-500'
                    : 'text-yellow-500';
                return (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <ExclamationTriangleIcon className={`w-4 h-4 ${severityColor} mt-0.5 flex-shrink-0`} />
                    <div>
                      <span className="font-medium text-gray-900">{issueItem.issue}</span>
                      {issueItem.description && (
                        <p className="text-gray-600 mt-0.5">{issueItem.description}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Formatting Tips */}
        {formattingTips.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <LightBulbIcon className="w-5 h-5 text-yellow-500" />
              <h4 className="font-semibold text-gray-900">Formatting Tips</h4>
            </div>
            <ul className="space-y-2">
              {formattingTips.slice(0, 5).map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Missing Keywords */}
      {keywordGaps.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-purple-500" />
            <h4 className="font-semibold text-gray-900">Missing Keywords</h4>
            <span className="text-xs text-gray-500 ml-auto">
              Consider adding these to your resume
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywordGaps.map((gap, index) => (
              <div
                key={index}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${
                  gap.importance === 'high'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : gap.importance === 'medium'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
                title={gap.whereToAdd}
              >
                <span className="font-medium">{gap.keyword}</span>
                <span className="text-xs opacity-70">({gap.category})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Industry Keywords */}
      {(industryKeywords.mustHave?.length > 0 || industryKeywords.niceToHave?.length > 0 || industryKeywords.trending?.length > 0) && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-5">
          <h4 className="font-semibold text-gray-900 mb-4">Industry Keywords to Consider</h4>
          <div className="space-y-3">
            {industryKeywords.mustHave?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1.5">Must Have</div>
                <div className="flex flex-wrap gap-2">
                  {industryKeywords.mustHave.map((keyword, index) => (
                    <span key={index} className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {industryKeywords.niceToHave?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1.5">Nice to Have</div>
                <div className="flex flex-wrap gap-2">
                  {industryKeywords.niceToHave.map((keyword, index) => (
                    <span key={index} className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-md text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {industryKeywords.trending?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1.5">Trending Skills</div>
                <div className="flex flex-wrap gap-2">
                  {industryKeywords.trending.map((keyword, index) => (
                    <span key={index} className="px-2.5 py-1 bg-pink-100 text-pink-700 rounded-md text-sm">
                      {keyword} ✨
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
