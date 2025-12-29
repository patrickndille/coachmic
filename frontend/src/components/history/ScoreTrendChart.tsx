import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { SessionSummary } from '../../types';

interface ScoreTrendChartProps {
  sessions: SessionSummary[];
}

export function ScoreTrendChart({ sessions }: ScoreTrendChartProps) {
  // Filter sessions with scores and prepare chart data
  const data = sessions
    .filter((s) => s.overallScore !== undefined && s.overallScore !== null)
    .map((s) => ({
      date: format(new Date(s.createdAt), 'MMM d'),
      score: s.overallScore,
      role: s.targetRole,
      fullDate: format(new Date(s.createdAt), 'MMM d, yyyy h:mm a'),
    }))
    .reverse(); // Chronological order

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Score Trend</h3>
        <div className="py-12 text-center text-gray-500">
          <p>No scored interviews yet.</p>
          <p className="text-sm mt-2">Complete more interviews to see your progress!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Score Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#4F46E5', strokeWidth: 1, strokeDasharray: '5 5' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="score"
            name="Interview Score"
            stroke="#4F46E5"
            strokeWidth={3}
            dot={{ r: 5, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Insights */}
      {data.length >= 2 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <ScoreInsights data={data} />
        </div>
      )}
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      date: string;
      role: string;
      fullDate: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 border border-gray-200">
      <p className="font-semibold text-gray-900 mb-1">Score: {payload[0].value}/100</p>
      <p className="text-sm text-gray-600">{data.role}</p>
      <p className="text-xs text-gray-500 mt-1">{data.fullDate}</p>
    </div>
  );
}

interface ScoreInsightsProps {
  data: Array<{ score: number | undefined }>;
}

function ScoreInsights({ data }: ScoreInsightsProps) {
  // Filter out undefined scores
  const validData = data.filter((d): d is { score: number } => d.score !== undefined);
  if (validData.length < 2) return null;
  
  const firstScore = validData[0].score;
  const lastScore = validData[validData.length - 1].score;
  const improvement = lastScore - firstScore;
  const averageScore = Math.round(validData.reduce((sum, d) => sum + d.score, 0) / validData.length);

  const highestScore = Math.max(...validData.map((d) => d.score));
  const lowestScore = Math.min(...validData.map((d) => d.score));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <InsightCard
        label="Improvement"
        value={improvement >= 0 ? `+${improvement}` : improvement.toString()}
        color={improvement >= 0 ? 'text-green-600' : 'text-red-600'}
      />
      <InsightCard
        label="Average"
        value={averageScore.toString()}
        color="text-blue-600"
      />
      <InsightCard
        label="Highest"
        value={highestScore.toString()}
        color="text-purple-600"
      />
      <InsightCard
        label="Lowest"
        value={lowestScore.toString()}
        color="text-gray-600"
      />
    </div>
  );
}

interface InsightCardProps {
  label: string;
  value: string;
  color: string;
}

function InsightCard({ label, value, color }: InsightCardProps) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );
}
