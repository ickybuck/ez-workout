import React from 'react';
import { Clock, Dumbbell } from 'lucide-react';

interface WorkoutTimerProps {
  elapsedTime: number;
  type?: 'workout' | 'exercise';
  size?: 'sm' | 'lg';
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const WorkoutTimer: React.FC<WorkoutTimerProps> = ({ elapsedTime, type = 'workout', size = 'lg' }) => {
  const isSmall = size === 'sm';
  const Icon = type === 'workout' ? Clock : Dumbbell;
  
  return (
    <div className={`flex items-center gap-2 font-mono ${isSmall ? 'text-base' : 'text-xl'}`}>
      <Icon className={`${isSmall ? 'h-4 w-4' : 'h-5 w-5'} ${type === 'workout' ? 'text-accent' : 'text-positive'}`} />
      <span className="tabular-nums">{formatTime(elapsedTime)}</span>
    </div>
  );
};

export default WorkoutTimer