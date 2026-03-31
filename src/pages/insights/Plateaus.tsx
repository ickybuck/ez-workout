import React from 'react';
import PlateauDetector from '../../components/insights/PlateauDetector';

interface PlateausProps {
  timeRange: '30' | '90' | '180' | 'all';
}

const Plateaus: React.FC<PlateausProps> = ({ timeRange }) => {
  return (
    <div>
      <PlateauDetector timeRange={timeRange} />
    </div>
  );
};

export default Plateaus;
