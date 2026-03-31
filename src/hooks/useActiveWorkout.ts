import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActiveWorkout } from '../types/workout';

interface ActiveWorkoutStore {
  workout: ActiveWorkout | null;
  setWorkout: (workout: ActiveWorkout | null) => void;
  currentExerciseIndex: number;
  setCurrentExerciseIndex: (index: number) => void;
  activeExerciseIndex: number;
  setActiveExerciseIndex: (index: number) => void;
}

const useActiveWorkoutStore = create<ActiveWorkoutStore>()(
  persist(
    (set) => ({
      workout: null,
      setWorkout: (workout) => set({ workout }),
      currentExerciseIndex: 0,
      setCurrentExerciseIndex: (index) => set({ currentExerciseIndex: index }),
      activeExerciseIndex: 0,
      setActiveExerciseIndex: (index) => set({ activeExerciseIndex: index }),
    }),
    {
      name: 'active-workout-storage',
    }
  )
);

export const useActiveWorkout = () => {
  const { 
    workout, 
    setWorkout, 
    currentExerciseIndex, 
    setCurrentExerciseIndex,
    activeExerciseIndex,
    setActiveExerciseIndex,
  } = useActiveWorkoutStore();

  const getCurrentExercise = () => {
    if (!workout || !workout.exercises.length) return null;
    return workout.exercises[currentExerciseIndex];
  };

  const getWorkoutDuration = () => {
    if (!workout) return 0;
    const start = new Date(workout.start_time).getTime();
    const end = workout.end_time ? new Date(workout.end_time).getTime() : Date.now();
    return Math.floor((end - start) / 1000);
  };

  return {
    workout,
    setWorkout,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    activeExerciseIndex,
    setActiveExerciseIndex,
    getCurrentExercise,
    getWorkoutDuration,
  };
};