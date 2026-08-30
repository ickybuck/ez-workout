import React from 'react';
import { ChevronDown, ChevronUp, Sun, Moon, Smartphone } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemePreference } from '../../lib/theme';

interface DisplayOptionsSectionProps {
  expanded: boolean;
  onToggle: () => void;
  showWorkoutTimer: boolean;
  showExerciseTimer: boolean;
  showVolumeGraph: boolean;
  showConsistencyTracker: boolean;
  onChange: (fields: Partial<{
    show_workout_timer: boolean;
    show_exercise_timer: boolean;
    show_volume_graph: boolean;
    show_consistency_tracker: boolean;
  }>) => void;
}

const DisplayOptionsSection: React.FC<DisplayOptionsSectionProps> = ({
  expanded,
  onToggle,
  showWorkoutTimer,
  showExerciseTimer,
  showVolumeGraph,
  showConsistencyTracker,
  onChange,
}) => {
  const { preference, setPreference } = useTheme();

  // "System" first, because it is the default and the one most people want.
  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'system', label: 'System', icon: Smartphone },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-content">Display Options</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-content-subtle" />
        ) : (
          <ChevronDown className="h-5 w-5 text-content-subtle" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="pb-3 border-b border-edge">
            <div className="text-sm font-medium text-content-muted mb-2">Appearance</div>
            <div className="inline-flex rounded-lg border border-edge-strong p-0.5">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPreference(value)}
                  aria-pressed={preference === value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    preference === value
                      ? 'bg-accent text-content-inverse'
                      : 'text-content-muted hover:bg-surface-sunken'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-content-subtle">
              Dark styling is being rolled out with the interface refresh; the setting is
              saved and applied now.
            </p>
          </div>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showWorkoutTimer}
              onChange={(e) => onChange({ show_workout_timer: e.target.checked })}
              className="h-4 w-4 text-accent focus:ring-accent border-edge-strong rounded"
            />
            <span className="text-content">Show Workout Timer</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showExerciseTimer}
              onChange={(e) => onChange({ show_exercise_timer: e.target.checked })}
              className="h-4 w-4 text-accent focus:ring-accent border-edge-strong rounded"
            />
            <span className="text-content">Show Exercise Timer</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showVolumeGraph}
              onChange={(e) => onChange({ show_volume_graph: e.target.checked })}
              className="h-4 w-4 text-accent focus:ring-accent border-edge-strong rounded"
            />
            <span className="text-content">Show Volume Graph</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showConsistencyTracker}
              onChange={(e) => onChange({ show_consistency_tracker: e.target.checked })}
              className="h-4 w-4 text-accent focus:ring-accent border-edge-strong rounded"
            />
            <span className="text-content">Show Workout Consistency Tracker</span>
          </label>
        </div>
      )}
    </div>
  );
};

export default DisplayOptionsSection;
