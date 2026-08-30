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
        <label className="block text-sm font-medium text-content-muted">Name</label>
        <input
          type="text"
          value={template.name}
          onChange={e => onChange({ ...template, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-muted">Description</label>
        <textarea
          value={template.description || ''}
          onChange={e => onChange({ ...template, description: e.target.value })}
          className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent"
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
          <label className="block text-sm font-medium text-content-muted mb-2">Category</label>
          <select
            value={template.category}
            onChange={e => onChange({ ...template, category: e.target.value as typeof categories[number] })}
            className="block w-full rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <p className="mt-1 text-sm text-content-subtle">
            Choose the primary focus area for this workout template
          </p>
        </div>
      </div>
    </div>
  );
};

export default TemplateForm;