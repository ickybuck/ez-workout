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
        <h3 className="text-lg font-medium text-gray-900">Admin Settings</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="mt-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={showAdminTools}
              onChange={(e) => onToggleAdminTools(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-gray-900">Show Admin Tools</span>
          </label>
          <p className="mt-1 text-sm text-gray-500">
            Toggle visibility of admin navigation and tools
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsSection;
