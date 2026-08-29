export interface ActiveWorkout {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  start_time: string;
  end_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  template_type: 'regular' | 'superset';
  exercises: ActiveWorkoutExercise[];
}

export interface ActiveWorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  /** Exercises sharing a group are performed together. Null is a straight set. */
  superset_group?: number | null;
  created_at: string;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    equipment_type: {
      id: string;
      name: string;
      emoji: string;
    };
    is_compound: boolean;
    is_plate_loaded: boolean;
  };
  logs: ExerciseLog[];
}

export interface ExerciseLog {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  completed: boolean;
  /** Reps short of the target. `reps` is the prescription, not the count. */
  failed_reps: number;
  /** Reps past the target. Mutually exclusive with failed_reps. */
  extra_reps?: number | null;
  /** Why the set ended. Null means not recorded — never inferred. */
  stop_reason?: string | null;
  /** Reps in reserve at set end, as a band. */
  set_rir?: string | null;
  recommend_increase: boolean;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped' | 'not_attempted';
}