export function calculateLogVolume(log: { weight: number; reps: number; failed_reps?: number; completed: boolean }): number {
  if (!log.completed) return 0;
  return log.weight * (log.reps - (log.failed_reps ?? 0));
}

export function calculateWorkoutVolume(workoutExercises: Array<{
  exercise_logs?: Array<{ weight: number; reps: number; failed_reps?: number; completed: boolean }> | null;
}>): number {
  return workoutExercises.reduce((total, we) => {
    return total + (we.exercise_logs?.reduce((sum, log) => sum + calculateLogVolume(log), 0) ?? 0);
  }, 0);
}
