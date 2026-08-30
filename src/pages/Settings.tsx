import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { useAdminStatus } from '../hooks/useAdminStatus';
import ProfileSection from '../components/settings/ProfileSection';
import UnitsAndPlatesSection from '../components/settings/UnitsAndPlatesSection';
import WorkoutPreferencesSection from '../components/settings/WorkoutPreferencesSection';
import DisplayOptionsSection from '../components/settings/DisplayOptionsSection';
import ExportDataSection from '../components/settings/ExportDataSection';
import TemplateAiSection from '../components/settings/TemplateAiSection';
import AccountSecuritySection from '../components/settings/AccountSecuritySection';
import AdminSettingsSection from '../components/settings/AdminSettingsSection';

interface UserSettings {
  use_metric: boolean;
  rest_timer_duration: number;
  auto_start_timer: boolean;
  weight_unit: 'kg' | 'lb';
  show_workout_timer: boolean;
  show_exercise_timer: boolean;
  show_volume_graph: boolean;
  show_consistency_tracker: boolean;
  weekly_workout_goal: number;
  goal_weekday_start: number;
  recent_workouts_count: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  weight: number | null;
  height: number | null;
  available_plates_kg: number[];
  available_plates_lb: number[];
}

const DEFAULT_SETTINGS: UserSettings = {
  use_metric: false,
  rest_timer_duration: 90,
  auto_start_timer: true,
  weight_unit: 'kg',
  show_workout_timer: true,
  show_exercise_timer: true,
  show_volume_graph: true,
  show_consistency_tracker: true,
  weekly_workout_goal: 3,
  goal_weekday_start: 0,
  recent_workouts_count: 3,
  username: null,
  first_name: null,
  last_name: null,
  weight: null,
  height: null,
  available_plates_kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  available_plates_lb: [45, 35, 25, 10, 5, 2.5],
};

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { unit: currentUnit, setUnit, convertWeight } = useWeightUnit();
  const { isAdmin, showAdminTools, setShowAdminTools } = useAdminStatus();

  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS, weight_unit: currentUnit });
  const [originalSettings, setOriginalSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const [workoutExpanded, setWorkoutExpanded] = useState(false);
  const [displayExpanded, setDisplayExpanded] = useState(false);
  const [exportExpanded, setExportExpanded] = useState(false);
  const [templateAiExpanded, setTemplateAiExpanded] = useState(false);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const weight = data.weight ? convertWeight(data.weight) : null;
        const loaded = {
          ...data,
          weight,
          available_plates_kg: data.available_plates_kg || [25, 20, 15, 10, 5, 2.5, 1.25],
          available_plates_lb: data.available_plates_lb || [45, 35, 25, 10, 5, 2.5],
        };
        setSettings(loaded);
        setOriginalSettings(loaded);
        setUnit(data.weight_unit);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const weight = settings.weight
        ? (settings.weight_unit === 'kg' ? settings.weight : convertWeight(settings.weight, 'kg'))
        : null;

      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...settings, weight, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

      if (error) throw error;

      setUnit(settings.weight_unit);
      setOriginalSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (fields: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...fields }));
  };

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="bg-surface-raised rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-content">Settings</h2>
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className="flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="space-y-6">
          <ProfileSection
            username={settings.username}
            firstName={settings.first_name}
            lastName={settings.last_name}
            weight={settings.weight}
            height={settings.height}
            weightUnit={settings.weight_unit}
            onChange={updateSettings}
          />

          <UnitsAndPlatesSection
            expanded={unitsExpanded}
            onToggle={() => setUnitsExpanded(!unitsExpanded)}
            weightUnit={settings.weight_unit}
            currentUnit={currentUnit}
            availablePlatesKg={settings.available_plates_kg}
            availablePlatesLb={settings.available_plates_lb}
            onChange={updateSettings}
          />

          <WorkoutPreferencesSection
            expanded={workoutExpanded}
            onToggle={() => setWorkoutExpanded(!workoutExpanded)}
            restTimerDuration={settings.rest_timer_duration}
            autoStartTimer={settings.auto_start_timer}
            weeklyWorkoutGoal={settings.weekly_workout_goal}
            goalWeekdayStart={settings.goal_weekday_start}
            recentWorkoutsCount={settings.recent_workouts_count}
            onChange={updateSettings}
          />

          <DisplayOptionsSection
            expanded={displayExpanded}
            onToggle={() => setDisplayExpanded(!displayExpanded)}
            showWorkoutTimer={settings.show_workout_timer}
            showExerciseTimer={settings.show_exercise_timer}
            showVolumeGraph={settings.show_volume_graph}
            showConsistencyTracker={settings.show_consistency_tracker}
            onChange={updateSettings}
          />

          <ExportDataSection
            expanded={exportExpanded}
            onToggle={() => setExportExpanded(!exportExpanded)}
            weightUnit={settings.weight_unit}
          />

          <TemplateAiSection
            expanded={templateAiExpanded}
            onToggle={() => setTemplateAiExpanded(!templateAiExpanded)}
          />

          <AccountSecuritySection
            expanded={securityExpanded}
            onToggle={() => setSecurityExpanded(!securityExpanded)}
            userEmail={user?.email}
          />

          {isAdmin && (
            <AdminSettingsSection
              expanded={adminExpanded}
              onToggle={() => setAdminExpanded(!adminExpanded)}
              showAdminTools={showAdminTools}
              onToggleAdminTools={setShowAdminTools}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
