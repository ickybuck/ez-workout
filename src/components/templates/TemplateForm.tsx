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
      {/* The Linear/Superset radio has gone. It set a template-wide flag that
          nothing reads any more: pairing is chosen per exercise, on the link
          between two of them, so a template can be part one and part the
          other. A control that no longer controls anything is worse than a
          missing one — it invites a decision that will be silently ignored. */}
      <div>
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