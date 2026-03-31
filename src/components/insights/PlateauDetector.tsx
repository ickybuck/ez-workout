import React, { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp, ArrowUp, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { toast } from 'sonner';
import { calculateLogVolume } from '../../lib/volumeUtils';

interface PlateauDetectorProps {
  timeRange: '30' | '90' | '180' | 'all';
}

interface PlateauExercise {
  id: string;
  name: string;
  lastWeight: number;
  lastReps: number;
  sessions: number;
  plateauWorkouts: number;
  weightIncrement: number;
  defaultWeight: number;
}

interface BodyweightPlateauExercise {
  id: string;
  name: string;
  lastReps: number;
  sessions: number;
  plateauWorkouts: number;
  defaultReps: number;
  repIncrement: number;
}

const PlateauDetector: React.FC<PlateauDetectorProps> = ({ timeRange }) => {
  const { user } = useAuth();
  const { formatWeight, unit } = useWeightUnit();
  const [plateaus, setPlateaus] = useState<PlateauExercise[]>([]);
  const [bodyweightPlateaus, setBodyweightPlateaus] = useState<BodyweightPlateauExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingExercises, setUpdatingExercises] = useState<Set<string>>(new Set());
  const [updatedExercises, setUpdatedExercises] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      detectPlateaus();
    }
  }, [user, timeRange]);

  const detectPlateaus = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const now = new Date();
      let startDate = new Date();

      if (timeRange === '30') {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === '90') {
        startDate.setDate(now.getDate() - 90);
      } else if (timeRange === '180') {
        startDate.setDate(now.getDate() - 180);
      } else {
        startDate = new Date(0);
      }

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          start_time,
          workout_exercises (
            exercise:exercises (
              id,
              name
            ),
            exercise_logs (
              weight,
              reps,
              failed_reps,
              completed,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('start_time', startDate.toISOString())
        .not('end_time', 'is', null)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const exerciseData: Record<string, {
        name: string;
        sessions: Array<{ date: string; maxWeight: number; maxReps: number; volume: number }>;
      }> = {};

      (workouts || []).forEach((workout: any) => {
        workout.workout_exercises?.forEach((we: any) => {
          if (!we.exercise) return;

          const completedLogs = we.exercise_logs?.filter((log: any) => log.completed) || [];
          if (completedLogs.length === 0) return;

          const maxWeight = Math.max(...completedLogs.map((log: any) => log.weight));
          const maxReps = Math.max(...completedLogs.map((log: any) => log.reps));
          const volume = completedLogs.reduce((sum: number, log: any) => sum + calculateLogVolume(log), 0);

          if (!exerciseData[we.exercise.id]) {
            exerciseData[we.exercise.id] = {
              name: we.exercise.name,
              sessions: [],
            };
          }

          exerciseData[we.exercise.id].sessions.push({
            date: workout.start_time,
            maxWeight,
            maxReps,
            volume,
          });
        });
      });

      const plateauExercises: PlateauExercise[] = [];
      const bodyweightPlateauExercises: BodyweightPlateauExercise[] = [];

      Object.entries(exerciseData).forEach(([id, data]) => {
        if (data.sessions.length >= 3) {
          // Check last 3 sessions to see if there's a plateau pattern
          const recentSessions = data.sessions.slice(-3);
          const weights = recentSessions.map(s => s.maxWeight);
          const reps = recentSessions.map(s => s.maxReps);
          const volumes = recentSessions.map(s => s.volume);

          const weightStagnant = weights.every(w => w === weights[0]);
          const repsStagnant = reps.every(r => r === reps[0]);
          const volumeChange = ((volumes[volumes.length - 1] - volumes[0]) / volumes[0]) * 100;

          if ((weightStagnant && repsStagnant) || Math.abs(volumeChange) < 5) {
            // Count consecutive plateau sessions from the end
            const lastWeight = data.sessions[data.sessions.length - 1].maxWeight;
            const lastReps = data.sessions[data.sessions.length - 1].maxReps;
            let plateauCount = 1;

            for (let i = data.sessions.length - 2; i >= 0; i--) {
              const session = data.sessions[i];
              if (session.maxWeight === lastWeight && session.maxReps === lastReps) {
                plateauCount++;
              } else {
                break;
              }
            }

            // Separate bodyweight (zero weight) exercises from weighted exercises
            if (lastWeight === 0) {
              bodyweightPlateauExercises.push({
                id,
                name: data.name,
                lastReps,
                sessions: data.sessions.length,
                plateauWorkouts: plateauCount,
                defaultReps: 0, // Will be populated below
                repIncrement: 1, // Will be populated below
              });
            } else {
              plateauExercises.push({
                id,
                name: data.name,
                lastWeight,
                lastReps,
                sessions: data.sessions.length,
                plateauWorkouts: plateauCount,
                weightIncrement: 0, // Will be populated below
                defaultWeight: 0, // Will be populated below
              });
            }
          }
        }
      });

      // Sort by longest plateau first
      plateauExercises.sort((a, b) => b.plateauWorkouts - a.plateauWorkouts);
      bodyweightPlateauExercises.sort((a, b) => b.plateauWorkouts - a.plateauWorkouts);

      // Fetch exercise_defaults data for all plateaued exercises
      const allPlateauIds = [
        ...plateauExercises.map(ex => ex.id),
        ...bodyweightPlateauExercises.map(ex => ex.id)
      ];

      if (allPlateauIds.length > 0) {
        const { data: exerciseDefaults, error: defaultsError } = await supabase
          .from('exercise_defaults')
          .select('exercise_id, weight, weight_increment, reps, rep_increment')
          .eq('user_id', user.id)
          .in('exercise_id', allPlateauIds);

        if (defaultsError) {
          console.error('Error fetching exercise defaults:', defaultsError);
        }

        console.log('Plateau IDs:', allPlateauIds);
        console.log('Exercise Defaults from DB:', exerciseDefaults);

        // Map exercise defaults to plateau exercises
        const defaultsMap = new Map(
          (exerciseDefaults || []).map(def => [
            def.exercise_id,
            {
              weight: Number(def.weight),
              weightIncrement: Number(def.weight_increment),
              reps: Number(def.reps),
              repIncrement: Number(def.rep_increment)
            }
          ])
        );

        console.log('Defaults Map:', Array.from(defaultsMap.entries()));

        // Default increment is always in kg (database stores in kg)
        const defaultWeightIncrement = 2.5; // kg - will be converted by formatWeight when displayed

        // Update weighted plateau exercises with defaults data
        plateauExercises.forEach(plateau => {
          const defaults = defaultsMap.get(plateau.id);
          plateau.defaultWeight = defaults?.weight || plateau.lastWeight;
          plateau.weightIncrement = defaults?.weightIncrement || defaultWeightIncrement;
          console.log(`Exercise ${plateau.name} (${plateau.id}):`, {
            defaults,
            weightIncrement: plateau.weightIncrement,
            defaultWeight: plateau.defaultWeight
          });
        });

        // Update bodyweight plateau exercises with defaults data
        bodyweightPlateauExercises.forEach(plateau => {
          const defaults = defaultsMap.get(plateau.id);
          plateau.defaultReps = defaults?.reps || plateau.lastReps;
          plateau.repIncrement = defaults?.repIncrement || 1;
        });
      }

      setPlateaus(plateauExercises);
      setBodyweightPlateaus(bodyweightPlateauExercises);
    } catch (error) {
      console.error('Error detecting plateaus:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = async (plateau: PlateauExercise) => {
    if (!user || updatingExercises.has(plateau.id)) return;

    try {
      setUpdatingExercises(prev => new Set(prev).add(plateau.id));

      const newWeight = plateau.defaultWeight + plateau.weightIncrement;

      // Upsert exercise_defaults
      const { error } = await supabase
        .from('exercise_defaults')
        .upsert({
          user_id: user.id,
          exercise_id: plateau.id,
          weight: newWeight,
          weight_increment: plateau.weightIncrement,
        }, {
          onConflict: 'user_id,exercise_id'
        });

      if (error) throw error;

      // Update local state
      setPlateaus(prev =>
        prev.map(p =>
          p.id === plateau.id
            ? { ...p, defaultWeight: newWeight }
            : p
        )
      );

      setUpdatedExercises(prev => new Set(prev).add(plateau.id));

      toast.success(
        `${plateau.name} weight increased from ${formatWeight(plateau.defaultWeight)} to ${formatWeight(newWeight)}`
      );
    } catch (error) {
      console.error('Error updating exercise weight:', error);
      toast.error('Failed to update exercise weight');
    } finally {
      setUpdatingExercises(prev => {
        const newSet = new Set(prev);
        newSet.delete(plateau.id);
        return newSet;
      });
    }
  };

  const handleRepIncrement = async (plateau: BodyweightPlateauExercise) => {
    if (!user || updatingExercises.has(plateau.id)) return;

    try {
      setUpdatingExercises(prev => new Set(prev).add(plateau.id));

      const newReps = plateau.defaultReps + plateau.repIncrement;

      // Upsert exercise_defaults
      const { error } = await supabase
        .from('exercise_defaults')
        .upsert({
          user_id: user.id,
          exercise_id: plateau.id,
          reps: newReps,
          rep_increment: plateau.repIncrement,
        }, {
          onConflict: 'user_id,exercise_id'
        });

      if (error) throw error;

      // Update local state
      setBodyweightPlateaus(prev =>
        prev.map(p =>
          p.id === plateau.id
            ? { ...p, defaultReps: newReps }
            : p
        )
      );

      setUpdatedExercises(prev => new Set(prev).add(plateau.id));

      toast.success(
        `${plateau.name} reps increased from ${plateau.defaultReps} to ${newReps}`
      );
    } catch (error) {
      console.error('Error updating exercise reps:', error);
      toast.error('Failed to update exercise reps');
    } finally {
      setUpdatingExercises(prev => {
        const newSet = new Set(prev);
        newSet.delete(plateau.id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          Plateau Detection
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (plateaus.length === 0 && bodyweightPlateaus.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-green-600" />
          Plateau Detection
        </h3>
        <div className="text-gray-600">
          <p>Great job! No exercises showing signs of plateau. Keep up the progressive overload!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-green-600" />
        Plateau Detection
      </h3>
      <p className="text-gray-600 mb-4">
        These exercises are ready for progression. Time to increase the intensity:
      </p>

      {plateaus.length > 0 && (
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Weighted Exercises</h4>
          {plateaus.map((plateau) => {
            const isUpdating = updatingExercises.has(plateau.id);
            const isUpdated = updatedExercises.has(plateau.id);

            return (
              <div
                key={plateau.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isUpdated
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{plateau.name}</h4>
                      {isUpdated && (
                        <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          Updated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>Last: {formatWeight(plateau.lastWeight)} × {plateau.lastReps} reps</span>
                      <span>Plateau: {plateau.plateauWorkouts} {plateau.plateauWorkouts === 1 ? 'workout' : 'workouts'}</span>
                      {isUpdated && (
                        <span className="text-blue-700 font-medium">
                          New: {formatWeight(plateau.defaultWeight)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleIncrement(plateau)}
                      disabled={isUpdating}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        isUpdating
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isUpdated
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="h-4 w-4" />
                          <span>+{formatWeight(plateau.weightIncrement)}</span>
                        </>
                      )}
                    </button>
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 ${isUpdated ? 'text-blue-600' : 'text-green-600'}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bodyweightPlateaus.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Bodyweight Exercises</h4>
          {bodyweightPlateaus.map((plateau) => {
            const isUpdating = updatingExercises.has(plateau.id);
            const isUpdated = updatedExercises.has(plateau.id);

            return (
              <div
                key={plateau.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isUpdated
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-purple-200 bg-purple-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{plateau.name}</h4>
                      {isUpdated && (
                        <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          Updated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>Last: {plateau.lastReps} reps</span>
                      <span>Plateau: {plateau.plateauWorkouts} {plateau.plateauWorkouts === 1 ? 'workout' : 'workouts'}</span>
                      {isUpdated && (
                        <span className="text-blue-700 font-medium">
                          New: {plateau.defaultReps} reps
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRepIncrement(plateau)}
                      disabled={isUpdating}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        isUpdating
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isUpdated
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="h-4 w-4" />
                          <span>+{plateau.repIncrement} rep{plateau.repIncrement !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </button>
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 ${isUpdated ? 'text-blue-600' : 'text-purple-600'}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlateauDetector;
