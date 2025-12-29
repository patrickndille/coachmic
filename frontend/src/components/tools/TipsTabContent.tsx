/**
 * TipsTabContent - Reusable interview tips content for Application Tools panel
 *
 * Wraps InterviewTipsContent component with consistent styling
 */

import { InterviewTipsContent } from '../guide';

export function TipsTabContent() {
  return (
    <div className="p-4">
      <InterviewTipsContent compact />

      {/* Footer hint */}
      <div className="text-center pt-4 mt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Review these tips before starting your interview
        </p>
      </div>
    </div>
  );
}
