import { supabase } from './supabase';

export interface ExportSet {
  set_number: number;
  weight_kg: number | null;
  weight_display: number | null;
  reps: number | null;
  completed: boolean;
  failed_reps: number;
  status: string;
}

export interface ExportExercise {
  order_index: number;
  exercise_name: string;
  sets: ExportSet[];
}

export interface ExportWorkout {
  id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  exercises: ExportExercise[];
}

export interface WorkoutCountResult {
  count: number;
  earliest: string | null;
  latest: string | null;
}

const KG_TO_LB = 2.20462262185;

function convertKgToDisplay(weightKg: number | null, unit: 'kg' | 'lb'): number | null {
  if (weightKg === null) return null;
  if (unit === 'kg') return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * KG_TO_LB * 10) / 10;
}

export async function getWorkoutCount(
  userId: string,
  startDate: string | null,
  endDate: string | null
): Promise<WorkoutCountResult> {
  let query = supabase
    .from('workouts')
    .select('start_time', { count: 'exact' })
    .eq('user_id', userId)
    .not('end_time', 'is', null);

  if (startDate) query = query.gte('start_time', startDate);
  if (endDate) query = query.lte('start_time', endDate + 'T23:59:59Z');

  const { data, count, error } = await query.order('start_time', { ascending: true });

  if (error) throw error;

  return {
    count: count ?? 0,
    earliest: data && data.length > 0 ? data[0].start_time : null,
    latest: data && data.length > 0 ? data[data.length - 1].start_time : null,
  };
}

export async function fetchWorkoutsForExport(
  userId: string,
  startDate: string | null,
  endDate: string | null,
  unit: 'kg' | 'lb'
): Promise<ExportWorkout[]> {
  let workoutQuery = supabase
    .from('workouts')
    .select(`
      id,
      name,
      start_time,
      end_time,
      notes,
      workout_exercises (
        id,
        order_index,
        exercises (
          name
        ),
        exercise_logs (
          set_number,
          weight,
          reps,
          completed,
          failed_reps,
          status
        )
      )
    `)
    .eq('user_id', userId)
    .not('end_time', 'is', null);

  if (startDate) workoutQuery = workoutQuery.gte('start_time', startDate);
  if (endDate) workoutQuery = workoutQuery.lte('start_time', endDate + 'T23:59:59Z');

  const { data, error } = await workoutQuery.order('start_time', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((w: any) => {
    const startTime = new Date(w.start_time);
    const endTime = w.end_time ? new Date(w.end_time) : null;
    const durationMinutes = endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
      : null;

    const exercises: ExportExercise[] = (w.workout_exercises ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((we: any) => {
        const sets: ExportSet[] = (we.exercise_logs ?? [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((log: any) => ({
            set_number: log.set_number,
            weight_kg: log.weight,
            weight_display: convertKgToDisplay(log.weight, unit),
            reps: log.reps,
            completed: log.completed,
            failed_reps: log.failed_reps ?? 0,
            status: log.status,
          }));

        return {
          order_index: we.order_index,
          exercise_name: we.exercises?.name ?? 'Unknown Exercise',
          sets,
        };
      });

    return {
      id: w.id,
      name: w.name,
      date: startTime.toISOString().split('T')[0],
      start_time: w.start_time,
      end_time: w.end_time,
      duration_minutes: durationMinutes,
      notes: w.notes,
      exercises,
    };
  });
}

export function exportAsJSON(workouts: ExportWorkout[], unit: 'kg' | 'lb'): void {
  const payload = {
    exported_at: new Date().toISOString(),
    weight_unit: unit,
    total_workouts: workouts.length,
    workouts: workouts.map((w) => ({
      id: w.id,
      name: w.name,
      date: w.date,
      start_time: w.start_time,
      end_time: w.end_time,
      duration_minutes: w.duration_minutes,
      notes: w.notes,
      exercises: w.exercises.map((e) => ({
        name: e.exercise_name,
        sets: e.sets.map((s) => ({
          set_number: s.set_number,
          [`weight_${unit}`]: s.weight_display,
          reps: s.reps,
          completed: s.completed,
          failed_reps: s.failed_reps,
          status: s.status,
        })),
      })),
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `workout-history-${formatDateForFilename()}.json`);
}

export function exportAsCSV(workouts: ExportWorkout[], unit: 'kg' | 'lb'): void {
  const headers = [
    'Date',
    'Workout Name',
    'Duration (mins)',
    'Exercise',
    'Set Order',
    `Weight (${unit})`,
    'Reps',
    'Completed',
    'Failed Reps',
    'Status',
    'Notes',
  ];

  const rows: string[][] = [headers];

  for (const workout of workouts) {
    if (workout.exercises.length === 0) {
      rows.push([
        workout.date,
        csvEscape(workout.name),
        workout.duration_minutes?.toString() ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        csvEscape(workout.notes ?? ''),
      ]);
      continue;
    }

    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        rows.push([
          workout.date,
          csvEscape(workout.name),
          workout.duration_minutes?.toString() ?? '',
          csvEscape(exercise.exercise_name),
          set.set_number.toString(),
          set.weight_display?.toString() ?? '',
          set.reps?.toString() ?? '',
          set.completed ? 'true' : 'false',
          set.failed_reps.toString(),
          set.status,
          csvEscape(workout.notes ?? ''),
        ]);
      }
    }
  }

  const csvContent = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `workout-history-${formatDateForFilename()}.csv`);
}

function csvEscape(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateForFilename(): string {
  return new Date().toISOString().split('T')[0];
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
