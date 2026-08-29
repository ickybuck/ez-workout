import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStrengthTrend } from '../../hooks/useStrengthTrend';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { roundForDisplay, MIN_TREND_POINTS, MIN_TREND_DAYS } from '../../lib/oneRepMax';

interface Props {
  timeRange: '30' | '90' | '180' | 'all';
}

const INITIAL_ROWS = 8;

/**
 * Estimated one-rep max per exercise.
 *
 * The strength series, shown apart from volume because they answer different
 * questions — volume rises when a set is added, this responds to load. Reading
 * them as one thing put Push Upper at "flat" while every press in it sat at a
 * lifetime best.
 *
 * A direction is only shown where there is enough data to claim one: four
 * sessions across three weeks. Below that the arrow is simply absent rather
 * than neutral, because "not enough data" and "no change" are different facts
 * and a flat arrow reads as the second.
 */
const StrengthProgress: React.FC<Props> = ({ timeRange }) => {
  const { series, loading } = useStrengthTrend(timeRange);
  const { unit } = useWeightUnit();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-4">
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (series.length === 0) return null;

  const shown = expanded ? series : series.slice(0, INITIAL_ROWS);

  return (
    <div className="bg-white rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-900">Estimated one-rep max</h3>
        <span className="text-xs text-gray-400">strength, not volume</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Estimated from your heaviest clean set each session. Sets above 15 reps
        are left out — the estimate stops being meaningful there.
      </p>

      <div className="space-y-2">
        {shown.map((row) => {
          const current = roundForDisplay(row.current.value, unit);
          const best = roundForDisplay(row.best.value, unit);

          return (
            <div key={row.exerciseId} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 flex-1 truncate">{row.exerciseName}</span>

              {/* Only when meaningfully below peak: within the noise band it is
                  the same number measured twice, not a decline. */}
              {row.belowBest && (
                <span className="text-xs text-gray-400 tabular-nums" title={`Best ${best} ${unit} on ${row.bestDate}`}>
                  best {best}
                </span>
              )}

              <span className="text-xs font-medium text-gray-900 tabular-nums w-16 text-right">
                {current} {unit}
              </span>

              <span className="w-14 text-right">
                {row.changePercent === null ? (
                  <span
                    className="text-xs text-gray-300"
                    title={`Needs ${MIN_TREND_POINTS} sessions across ${MIN_TREND_DAYS} days before a direction is claimed`}
                  >
                    —
                  </span>
                ) : (
                  <span
                    className={`text-xs inline-flex items-center gap-0.5 tabular-nums ${
                      row.changePercent > 2
                        ? 'text-emerald-600'
                        : row.changePercent < -2
                          ? 'text-amber-700'
                          : 'text-gray-400'
                    }`}
                  >
                    {row.changePercent > 2 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : row.changePercent < -2 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {Math.abs(Math.round(row.changePercent))}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {series.length > INITIAL_ROWS && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-indigo-600 hover:text-indigo-700"
        >
          {expanded ? 'Show fewer' : `Show all ${series.length}`}
        </button>
      )}
    </div>
  );
};

export default StrengthProgress;
