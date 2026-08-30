import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AdminSettingsSectionProps {
  expanded: boolean;
  onToggle: () => void;
  showAdminTools: boolean;
  onToggleAdminTools: (value: boolean) => void;
}

const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({
  expanded,
  onToggle,
  showAdminTools,
  onToggleAdminTools,
}) => {
  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-content">Admin Settings</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-content-subtle" />
        ) : (
          <ChevronDown className="h-5 w-5 text-content-subtle" />
        )}
      </button>

      {expanded && (
        <div className="mt-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showAdminTools}
              onChange={(e) => onToggleAdminTools(e.target.checked)}
              className="h-4 w-4 text-accent focus:ring-accent border-edge-strong rounded"
            />
            <span className="text-content">Show Admin Tools</span>
          </label>
          <p className="mt-1 text-sm text-content-subtle">
            Toggle visibility of admin navigation and tools
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsSection;
