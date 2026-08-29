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
      <div className="bg-surface-raised rounded-lg p-4">
        <div className="h-4 w-40 bg-surface-sunken rounded animate-pulse" />
      </div>
    );
  }

  if (series.length === 0) return null;

  const shown = expanded ? series : series.slice(0, INITIAL_ROWS);

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-content">Strength by exercise</h3>
        <span className="text-xs text-content-subtle">load, not volume</span>
      </div>

      <p className="text-xs text-content-subtle mb-3">
        Heaviest set lifted, with an estimated one-rep max beside it. The
        estimate assumes an unbroken set — if you break a heavy set into clusters
        it will read high, so the measured load leads.
      </p>

      <div className="space-y-2">
        {shown.map((row) => {
          const estimate = roundForDisplay(row.current.value, unit);
          const best = roundForDisplay(row.best.value, unit);
          const topSet = roundForDisplay(row.currentTopSet, unit);

          return (
            <div key={row.exerciseId} className="flex items-center gap-2">
              <span className="text-xs text-content-muted flex-1 truncate">{row.exerciseName}</span>

              {/* Only when meaningfully below peak: within the noise band it is
                  the same number measured twice, not a decline. */}
              {row.belowBest && (
                <span className="text-xs text-content-subtle tabular-nums" title={`Best estimate ${best} ${unit} on ${row.bestDate}`}>
                  best {best}
                </span>
              )}

              {/* Measured load first, estimate second and visibly lesser. The
                  estimate assumes an unbroken set and this athlete clusters
                  heavy ones, so it should never be the number that reads as
                  the fact. */}
              <span className="text-xs font-medium text-content tabular-nums w-16 text-right">
                {topSet} {unit}
              </span>
              <span
                className="text-xs text-content-subtle tabular-nums w-16 text-right"
                title="Estimated one-rep max — assumes an unbroken set"
              >
                ~{estimate}
              </span>

              <span className="w-14 text-right">
                {row.changePercent === null ? (
                  <span
                    className="text-xs text-content-subtle"
                    title={`Needs ${MIN_TREND_POINTS} sessions across ${MIN_TREND_DAYS} days before a direction is claimed`}
                  >
                    —
                  </span>
                ) : (
                  <span
                    className={`text-xs inline-flex items-center gap-0.5 tabular-nums ${
                      row.changePercent > 2
                        ? 'text-positive'
                        : row.changePercent < -2
                          ? 'text-caution'
                          : 'text-content-subtle'
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
          className="mt-3 text-xs text-accent hover:text-accent-hover"
        >
          {expanded ? 'Show fewer' : `Show all ${series.length}`}
        </button>
      )}
    </div>
  );
};

export default StrengthProgress;
