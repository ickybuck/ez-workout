import React, { useEffect, useState, useMemo } from 'react';
import { AlertCircle, TrendingUp, ArrowUp, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { toast } from 'sonner';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { detectPlateaus } from '../../lib/plateau';

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
  const { formatWeight } = useWeightUnit();
  const { data: workouts, loading: historyLoading } = useWorkoutHistory(timeRange);
  const [plateaus, setPlateaus] = useState<PlateauExercise[]>([]);
  const [bodyweightPlateaus, setBodyweightPlateaus] = useState<BodyweightPlateauExercise[]>([]);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [updatingExercises, setUpdatingExercises] = useState<Set<string>>(new Set());
  const [updatedExercises, setUpdatedExercises] = useState<Set<string>>(new Set());

  const loading = historyLoading || loadingDefaults;

  // Detection itself is pure and tested in src/lib/plateau.ts.
  const candidates = useMemo(() => detectPlateaus(workouts), [workouts]);

  // The per-user increments live in exercise_defaults, so they need a second
  // query once we know which exercises stalled. Kept as an effect rather than
  // folded into the fetch, so detection stays independent of the network.
  useEffect(() => {
    const ids = [...candidates.weighted, ...candidates.bodyweight].map((c) => c.id);

    if (!user || ids.length === 0) {
      setPlateaus([]);
      setBodyweightPlateaus([]);
      return;
    }

    let cancelled = false;
    setLoadingDefaults(true);

    supabase
      .from('exercise_defaults')
      .select('exercise_id, weight, weight_increment, reps, rep_increment')
      .eq('user_id', user.id)
      .in('exercise_id', ids)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Error fetching exercise defaults:', error);

        const defaults = new Map(
          (data ?? []).map((d) => [
            d.exercise_id,
            {
              weight: Number(d.weight),
              weightIncrement: Number(d.weight_increment),
              reps: Number(d.reps),
              repIncrement: Number(d.rep_increment),
            },
          ]),
        );

        // Stored in kg; formatWeight converts for display.
        const FALLBACK_WEIGHT_INCREMENT = 2.5;

        setPlateaus(
          candidates.weighted.map((c) => ({
            ...c,
            defaultWeight: defaults.get(c.id)?.weight || c.lastWeight,
            weightIncrement: defaults.get(c.id)?.weightIncrement || FALLBACK_WEIGHT_INCREMENT,
          })),
        );

        setBodyweightPlateaus(
          candidates.bodyweight.map((c) => ({
            ...c,
            defaultReps: defaults.get(c.id)?.reps || c.lastReps,
            repIncrement: defaults.get(c.id)?.repIncrement || 1,
          })),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) console.error('Error resolving plateau defaults:', e);
      })
      .finally(() => {
        // finally, not then: a throw above must still clear the spinner.
        if (!cancelled) setLoadingDefaults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, candidates]);


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
      <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
        <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-caution" />
          Plateau Detection
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  if (plateaus.length === 0 && bodyweightPlateaus.length === 0) {
    return (
      <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
        <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-positive" />
          Plateau Detection
        </h3>
        <div className="text-content-muted">
          <p>Great job! No exercises showing signs of plateau. Keep up the progressive overload!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-lg shadow-sm border border-edge p-4 mb-4">
      <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-positive" />
        Plateau Detection
      </h3>
      <p className="text-content-muted mb-4">
        These exercises are ready for progression. Time to increase the intensity:
      </p>

      {plateaus.length > 0 && (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-semibold text-content-muted uppercase tracking-wide">Weighted Exercises</h4>
          {plateaus.map((plateau) => {
            const isUpdating = updatingExercises.has(plateau.id);
            const isUpdated = updatedExercises.has(plateau.id);

            return (
              <div
                key={plateau.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isUpdated
                    ? 'border-accent bg-accent-soft'
                    : 'border-positive bg-positive-soft'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-content">{plateau.name}</h4>
                      {isUpdated && (
                        <span className="flex items-center gap-1 text-xs text-accent-content bg-accent-soft px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          Updated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-content-muted">
                      <span>Last: {formatWeight(plateau.lastWeight)} × {plateau.lastReps} reps</span>
                      <span>Plateau: {plateau.plateauWorkouts} {plateau.plateauWorkouts === 1 ? 'workout' : 'workouts'}</span>
                      {isUpdated && (
                        <span className="text-accent-content font-medium">
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
                          ? 'bg-surface-sunken text-content-subtle cursor-not-allowed'
                          : isUpdated
                          ? 'bg-accent text-content-inverse hover:bg-accent-hover'
                          : 'bg-positive text-content-inverse hover:bg-positive'
                      }`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-edge border-t-transparent" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="h-4 w-4" />
                          <span>+{formatWeight(plateau.weightIncrement)}</span>
                        </>
                      )}
                    </button>
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 ${isUpdated ? 'text-accent' : 'text-positive'}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bodyweightPlateaus.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-content-muted uppercase tracking-wide">Bodyweight Exercises</h4>
          {bodyweightPlateaus.map((plateau) => {
            const isUpdating = updatingExercises.has(plateau.id);
            const isUpdated = updatedExercises.has(plateau.id);

            return (
              <div
                key={plateau.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isUpdated
                    ? 'border-accent bg-accent-soft'
                    : 'border-accent bg-accent-soft'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-content">{plateau.name}</h4>
                      {isUpdated && (
                        <span className="flex items-center gap-1 text-xs text-accent-content bg-accent-soft px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          Updated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-content-muted">
                      <span>Last: {plateau.lastReps} reps</span>
                      <span>Plateau: {plateau.plateauWorkouts} {plateau.plateauWorkouts === 1 ? 'workout' : 'workouts'}</span>
                      {isUpdated && (
                        <span className="text-accent-content font-medium">
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
                          ? 'bg-surface-sunken text-content-subtle cursor-not-allowed'
                          : isUpdated
                          ? 'bg-accent text-content-inverse hover:bg-accent-hover'
                          : 'bg-accent text-content-inverse hover:bg-accent'
                      }`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-edge border-t-transparent" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="h-4 w-4" />
                          <span>+{plateau.repIncrement} rep{plateau.repIncrement !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </button>
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 ${isUpdated ? 'text-accent' : 'text-accent-content'}`} />
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
