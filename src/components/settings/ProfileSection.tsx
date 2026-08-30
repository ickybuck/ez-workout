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
    // No bottom border: every section below opens with `pt-6 border-t`, so a
    // closing border here drew a second line one gap from the next section's.
    <div className="pb-6">
      <h3 className="text-lg font-medium text-content mb-4">Profile</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-content-muted">Username</label>
          <input
            type="text"
            value={username || ''}
            onChange={(e) => onChange({ username: e.target.value })}
            className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-content-muted">First Name</label>
            <input
              type="text"
              value={firstName || ''}
              onChange={(e) => onChange({ first_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-muted">Last Name</label>
            <input
              type="text"
              value={lastName || ''}
              onChange={(e) => onChange({ last_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-content-muted">Weight ({weightUnit})</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weight || ''}
              onChange={(e) => onChange({ weight: parseFloat(e.target.value) || null })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-muted">Height (cm)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={height || ''}
              onChange={(e) => onChange({ height: parseFloat(e.target.value) || null })}
              className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;
