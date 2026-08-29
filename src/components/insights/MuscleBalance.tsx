import React from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { useMuscleBalance } from '../../hooks/useMuscleBalance';
import { WEEKLY_TARGET } from '../../lib/effectiveSets';

interface Props {
  timeRange: '30' | '90' | '180' | 'all';
}

const VERDICT_STYLE = {
  'under-served': { bar: 'bg-amber-500', label: 'text-amber-700' },
  'in range': { bar: 'bg-emerald-500', label: 'text-gray-500' },
  high: { bar: 'bg-red-500', label: 'text-red-700' },
} as const;

/**
 * Weekly effective sets per muscle.
 *
 * Shown as a rate with a target band rather than a score, because the evidence
 * behind the band is a broad productive zone with real individual variation —
 * not a number to hit. The bar is scaled to the top of that band so a muscle
 * inside it looks unremarkable, which is what being inside it means.
 */
const MuscleBalance: React.FC<Props> = ({ timeRange }) => {
  const { summary, loading } = useMuscleBalance(timeRange);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-4">
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!summary || summary.perMuscle.length === 0) return null;

  const scale = Math.max(WEEKLY_TARGET.max, summary.perMuscle[0]?.effectiveSets ?? 0);

  return (
    <div className="bg-white rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-900">Weekly sets per muscle</h3>
        <span className="text-xs text-gray-400">
          target {WEEKLY_TARGET.min}–{WEEKLY_TARGET.max}
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Hard sets that carried load, counted once for each muscle they work
        directly and a half for each they assist. Unloaded core and conditioning
        work is counted separately below.
      </p>

      <div className="space-y-1.5">
        {summary.perMuscle.map((muscle) => {
          const style = VERDICT_STYLE[muscle.verdict];
          return (
            <div key={muscle.muscle} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 w-28 flex-shrink-0 truncate">
                {muscle.muscle}
              </span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.bar}`}
                  style={{ width: `${Math.min((muscle.effectiveSets / scale) * 100, 100)}%` }}
                />
              </div>
              <span className={`text-xs w-8 text-right tabular-nums ${style.label}`}>
                {muscle.effectiveSets}
              </span>
            </div>
          );
        })}
      </div>

      {/* What was excluded, and why. A number that quietly drops a fifth of the
          work is worse than no number. */}
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
        {summary.conditioningSets > 0 && (
          <p className="text-xs text-gray-400 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            {summary.conditioningSets} unloaded set
            {summary.conditioningSets === 1 ? '' : 's'} counted as conditioning, not muscle volume.
          </p>
        )}
        {summary.incompleteSets > 0 && (
          <p className="text-xs text-gray-400 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            {summary.incompleteSets} set{summary.incompleteSets === 1 ? '' : 's'} skipped or cut
            short, excluded.
          </p>
        )}
        {summary.unmapped.length > 0 && (
          <p className="text-xs text-amber-700 flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            Not counted anywhere — no muscles set:{' '}
            {summary.unmapped.map((u) => `${u.exerciseName} (${u.sets})`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
};

export default MuscleBalance;
