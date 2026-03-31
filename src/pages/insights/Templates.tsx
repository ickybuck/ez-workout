import React from 'react';
import TemplateProgress from '../../components/insights/TemplateProgress';

interface TemplatesProps {
  timeRange: '30' | '90' | '180' | 'all';
}

const Templates: React.FC<TemplatesProps> = ({ timeRange }) => {
  return (
    <div>
      <TemplateProgress timeRange={timeRange} />
    </div>
  );
};

export default Templates;
