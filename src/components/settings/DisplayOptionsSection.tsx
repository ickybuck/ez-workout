import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-gray-900">Display Options</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showWorkoutTimer}
              onChange={(e) => onChange({ show_workout_timer: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-gray-900">Show Workout Timer</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showExerciseTimer}
              onChange={(e) => onChange({ show_exercise_timer: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-gray-900">Show Exercise Timer</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showVolumeGraph}
              onChange={(e) => onChange({ show_volume_graph: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-gray-900">Show Volume Graph</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showConsistencyTracker}
              onChange={(e) => onChange({ show_consistency_tracker: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-gray-900">Show Workout Consistency Tracker</span>
          </label>
        </div>
      )}
    </div>
  );
};

export default DisplayOptionsSection;
