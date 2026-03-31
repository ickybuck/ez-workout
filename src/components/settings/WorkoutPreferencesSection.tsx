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
        <h3 className="text-lg font-medium text-gray-900">Workout Preferences</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rest Timer Duration (seconds)
            </label>
            <input
              type="number"
              value={restTimerDuration}
              onChange={(e) => onChange({ rest_timer_duration: parseInt(e.target.value) })}
              min="0"
              max="600"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={autoStartTimer}
              onChange={(e) => onChange({ auto_start_timer: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-gray-900">Auto-start Rest Timer</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700">Weekly Workout Goal</label>
            <select
              value={weeklyWorkoutGoal}
              onChange={(e) => onChange({ weekly_workout_goal: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'workout' : 'workouts'} per week
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Week Starts On</label>
            <select
              value={goalWeekdayStart}
              onChange={(e) => onChange({ goal_weekday_start: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Recent Workouts to Show</label>
            <select
              value={recentWorkoutsCount}
              onChange={(e) => onChange({ recent_workouts_count: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
