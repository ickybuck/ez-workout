import React from 'react';
import { Info } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks, isWithinInterval } from 'date-fns';

interface ConsistencyTrackerProps {
  workouts: Array<{ end_time: string }>;
  weeklyGoal: number;
  weekdayStart: number;
}

const ConsistencyTracker: React.FC<ConsistencyTrackerProps> = ({
  workouts,
  weeklyGoal,
  weekdayStart,
}) => {
  // Get the last 12 weeks
  const today = new Date();
  const twelveWeeksAgo = subWeeks(today, 11);

  // Get array of week intervals
  const weekIntervals = eachWeekOfInterval(
    { start: twelveWeeksAgo, end: today },
    { weekStartsOn: weekdayStart }
  ).map(weekStart => ({
    startDate: startOfWeek(weekStart, { weekStartsOn: weekdayStart }),
    endDate: endOfWeek(weekStart, { weekStartsOn: weekdayStart }),
    workouts: 0,
    goal: weeklyGoal,
  }));

  // Count workouts for each week
  workouts.forEach(workout => {
    const workoutDate = new Date(workout.end_time);
    const week = weekIntervals.find(interval =>
      isWithinInterval(workoutDate, {
        start: interval.startDate,
        end: interval.endDate,
      })
    );
    if (week) {
      week.workouts++;
    }
  });

  // Get color based on goal completion
  const getStatusColor = (completed: number, goal: number) => {
    const diff = goal - completed;
    if (diff <= 0) return 'bg-positive-soft text-positive-content border-positive'; // Met or exceeded goal
    if (diff === 1) return 'bg-caution-soft text-caution-content border-caution'; // 1 workout below
    if (diff <= 3) return 'bg-caution-soft text-caution-content border-caution'; // 2-3 workouts below
    return 'bg-critical-soft text-critical-content border-critical'; // 4+ workouts below
  };

  return (
    <div className="bg-surface-raised rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-content">Workout Consistency</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-content-subtle">Goal: {weeklyGoal} per week</span>
          <div className="group relative">
            <Info className="h-4 w-4 text-content-subtle" />
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-surface-overlay text-content border border-edge text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              Week starts on {format(startOfWeek(today, { weekStartsOn: weekdayStart }), 'EEEE')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2">
        {weekIntervals.reverse().map((week) => (
          <div
            key={week.startDate.toISOString()}
            className={`aspect-square rounded border flex items-center justify-center text-sm font-medium ${getStatusColor(
              week.workouts,
              week.goal
            )}`}
            title={`${format(week.startDate, 'MMM d')} - ${format(
              week.endDate,
              'MMM d'
            )}\n${week.workouts} workouts completed\n${
              week.workouts >= week.goal 
                ? 'Goal met!' 
                : `${week.goal - week.workouts} more needed`
            }`}
          >
            {week.workouts}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsistencyTracker;