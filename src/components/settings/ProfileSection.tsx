import React from 'react';

interface ProfileSectionProps {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  weight: number | null;
  height: number | null;
  weightUnit: 'kg' | 'lb';
  onChange: (fields: Partial<{
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    weight: number | null;
    height: number | null;
  }>) => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  username,
  firstName,
  lastName,
  weight,
  height,
  weightUnit,
  onChange,
}) => {
  return (
    <div className="border-b pb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Profile</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            value={username || ''}
            onChange={(e) => onChange({ username: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input
              type="text"
              value={firstName || ''}
              onChange={(e) => onChange({ first_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input
              type="text"
              value={lastName || ''}
              onChange={(e) => onChange({ last_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Weight ({weightUnit})</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weight || ''}
              onChange={(e) => onChange({ weight: parseFloat(e.target.value) || null })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={height || ''}
              onChange={(e) => onChange({ height: parseFloat(e.target.value) || null })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;
