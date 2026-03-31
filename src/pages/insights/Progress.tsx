import React from 'react';
import ProgressChart from '../../components/insights/ProgressChart';
import VolumeAnalysis from '../../components/insights/VolumeAnalysis';

interface ProgressProps {
  timeRange: '30' | '90' | '180' | 'all';
}

const Progress: React.FC<ProgressProps> = ({ timeRange }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ProgressChart timeRange={timeRange} />
      <VolumeAnalysis timeRange={timeRange} />
    </div>
  );
};

export default Progress;
