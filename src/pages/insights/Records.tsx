import React from 'react';
import PersonalRecords from '../../components/insights/PersonalRecords';

interface RecordsProps {
  timeRange: '30' | '90' | '180' | 'all';
}

const Records: React.FC<RecordsProps> = ({ timeRange }) => {
  return (
    <div>
      <PersonalRecords timeRange={timeRange} />
    </div>
  );
};

export default Records;
