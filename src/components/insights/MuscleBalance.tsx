import React from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { useMuscleBalance } from '../../hooks/useMuscleBalance';
import { WEEKLY_TARGET } from '../../lib/effectiveSets';

interface Props {
  timeRange: '30' | '90' | '180' | 'all';
}

const VERDICT_STYLE = {
  'under-served': { bar: 'bg-caution', label: 'text-caution' },
  'in range': { bar: 'bg-positive', label: 'text-content-subtle' },
  high: { bar: 'bg-critical', label: 'text-critical' },
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
      <div className="bg-surface-raised rounded-lg p-4">
        <div className="h-4 w-40 bg-surface-sunken rounded animate-pulse" />
      </div>
    );
  }

  if (!summary || summary.perMuscle.length === 0) return null;

  const scale = Math.max(WEEKLY_TARGET.max, summary.perMuscle[0]?.effectiveSets ?? 0);

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-content">Weekly sets per muscle</h3>
        <span className="text-xs text-content-subtle">
          target {WEEKLY_TARGET.min}–{WEEKLY_TARGET.max}
        </span>
      </div>

      <p className="text-xs text-content-subtle mb-3">
        Hard sets that carried load, counted once for each muscle they work
        directly and a half for each they assist. Unloaded core and conditioning
        work is counted separately below.
      </p>

      <div className="space-y-1.5">
        {summary.perMuscle.map((muscle) => {
          const style = VERDICT_STYLE[muscle.verdict];
          return (
            <div key={muscle.muscle} className="flex items-center gap-2">
              <span className="text-xs text-content-muted w-28 flex-shrink-0 truncate">
                {muscle.muscle}
              </span>
              <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden">
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
      <div className="mt-3 pt-3 border-t border-edge space-y-1">
        {summary.conditioningSets > 0 && (
          <p className="text-xs text-content-subtle flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            {summary.conditioningSets} unloaded set
            {summary.conditioningSets === 1 ? '' : 's'} counted as conditioning, not muscle volume.
          </p>
        )}
        {summary.incompleteSets > 0 && (
          <p className="text-xs text-content-subtle flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            {summary.incompleteSets} set{summary.incompleteSets === 1 ? '' : 's'} skipped or cut
            short, excluded.
          </p>
        )}
        {summary.unmapped.length > 0 && (
          <p className="text-xs text-caution flex items-start gap-1.5">
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
