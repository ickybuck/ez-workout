import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface WorkoutPreferencesSectionProps {
  expanded: boolean;
  onToggle: () => void;
  restTimerDuration: number;
  autoStartTimer: boolean;
  weeklyWorkoutGoal: number;
  goalWeekdayStart: number;
  recentWorkoutsCount: number;
  onChange: (fields: Partial<{
    rest_timer_duration: number;
    auto_start_timer: boolean;
    weekly_workout_goal: number;
    goal_weekday_start: number;
    recent_workouts_count: number;
  }>) => void;
}

const WorkoutPreferencesSection: React.FC<WorkoutPreferencesSectionProps> = ({
  expanded,
  onToggle,
  restTimerDuration,
  autoStartTimer,
  weeklyWorkoutGoal,
  goalWeekdayStart,
  recentWorkoutsCount,
  onChange,
}) => {
  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-content">Workout Preferences</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-content-subtle" />
        ) : (
          <ChevronDown className="h-5 w-5 text-content-subtle" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-muted">
              Rest Timer Duration (seconds)
            </label>
            <input
              type="number"
              value={restTimerDuration}
              onChange={(e) => onChange({ rest_timer_duration: parseInt(e.target.value) })}
              min="0"
              max="600"
              className="mt-1 block w-full border-edge-strong rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
            />
          </div>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={autoStartTimer}
              onChange={(e) => onChange({ auto_start_timer: e.target.checked })}
              className="h-4 w-4 text-accent focus:ring-accent border-edge-strong rounded"
            />
            <span className="text-content">Auto-start Rest Timer</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-content-muted">Weekly Workout Goal</label>
            <select
              value={weeklyWorkoutGoal}
              onChange={(e) => onChange({ weekly_workout_goal: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'workout' : 'workouts'} per week
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-muted">Week Starts On</label>
            <select
              value={goalWeekdayStart}
              onChange={(e) => onChange({ goal_weekday_start: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-muted">Recent Workouts to Show</label>
            <select
              value={recentWorkoutsCount}
              onChange={(e) => onChange({ recent_workouts_count: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'workout' : 'workouts'}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPreferencesSection;
