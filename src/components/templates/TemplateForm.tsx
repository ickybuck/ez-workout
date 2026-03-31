import React from 'react';
import { WorkoutTemplate } from '../../types/template';

interface TemplateFormProps {
  template: WorkoutTemplate;
  onChange: (template: WorkoutTemplate) => void;
}

const TemplateForm: React.FC<TemplateFormProps> = ({ template, onChange }) => {
  const categories = ['Upper Body', 'Lower Body', 'Core Focused', 'Whole Body'] as const;

  return (
    <div className="space-y-4 mb-8">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={template.name}
          onChange={e => onChange({ ...template, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={template.description || ''}
          onChange={e => onChange({ ...template, description: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Template Type</label>
          <div className="space-y-2">
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="regular"
                checked={template.template_type === 'regular'}
                onChange={e => onChange({ ...template, template_type: e.target.value as 'regular' | 'superset' })}
                className="form-radio h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-gray-700">Linear</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="superset"
                checked={template.template_type === 'superset'}
                onChange={e => onChange({ ...template, template_type: e.target.value as 'regular' | 'superset' })}
                className="form-radio h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-gray-700">Superset</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {template.template_type === 'superset' 
              ? 'Perform two exercises back-to-back with minimal rest between them'
              : 'Move through exercises one at a time, with rest between each set'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={template.category}
            onChange={e => onChange({ ...template, category: e.target.value as typeof categories[number] })}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Choose the primary focus area for this workout template
          </p>
        </div>
      </div>
    </div>
  );
};

export default TemplateForm;