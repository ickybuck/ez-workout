import React, { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { EquipmentType, BodyPart, MuscleGroup } from '../../types/exercise';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import PlateCalculator from './PlateCalculator';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface ExerciseFormV2Props {
  editForm: {
    name?: string;
    description?: string;
    equipment_type?: EquipmentType;
    body_part?: BodyPart;
    is_compound?: boolean;
    is_plate_loaded?: boolean;
    defaults?: {
      sets?: number;
      reps?: number;
      weight?: number;
      weight_increment?: number;
      rep_increment?: number;
      bar_weight?: number;
    };
  };
  setEditForm: (form: any) => void;
  selectedMuscleGroups: Array<{ id: string; is_primary: boolean }>;
  toggleMuscleGroup: (muscleGroupId: string, isPrimary: boolean) => void;
  equipmentTypes: EquipmentType[];
  bodyParts: BodyPart[];
  muscleGroups: MuscleGroup[];
  onCancel: () => void;
  onSave: () => Promise<void>;
  isEditing: boolean;
  exerciseId?: string;
}

const ExerciseFormV2: React.FC<ExerciseFormV2Props> = ({
  editForm,
  setEditForm,
  selectedMuscleGroups,
  toggleMuscleGroup,
  equipmentTypes,
  bodyParts,
  muscleGroups,
  onCancel,
  onSave,
  isEditing,
  exerciseId,
}) => {
  const { unit, convertWeight, parseWeight, formatWeight } = useWeightUnit();
  const [saving, setSaving] = useState(false);
  const [showPlateCalculator, setShowPlateCalculator] = useState(false);
  const [displayWeight, setDisplayWeight] = useState(convertWeight(editForm.defaults?.weight || 0));
  const [displayIncrement, setDisplayIncrement] = useState(convertWeight(editForm.defaults?.weight_increment || 2.3));
  const [displayRepIncrement, setDisplayRepIncrement] = useState(editForm.defaults?.rep_increment || 1);
  const [displayBarWeight, setDisplayBarWeight] = useState(convertWeight(editForm.defaults?.bar_weight || 20, undefined, true));

  // Group muscles by category
  const groupedMuscles = muscleGroups.reduce((acc, muscle) => {
    if (!acc[muscle.category]) {
      acc[muscle.category] = [];
    }
    acc[muscle.category].push(muscle);
    return acc;
  }, {} as Record<string, MuscleGroup[]>);

  // Load exercise defaults when needed
  const loadExerciseDefaults = async () => {
    if (!exerciseId) return;

    try {
      const { data, error } = await supabase
        .from('exercise_defaults')
        .select('*')
        .eq('exercise_id', exerciseId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setEditForm({
          ...editForm,
          defaults: {
            ...editForm.defaults,
            weight: data.weight,
            weight_increment: data.weight_increment,
            rep_increment: data.rep_increment,
            bar_weight: data.bar_weight,
          },
        });
        setDisplayWeight(convertWeight(data.weight));
        setDisplayIncrement(convertWeight(data.weight_increment));
        setDisplayRepIncrement(data.rep_increment || 1);
        setDisplayBarWeight(convertWeight(data.bar_weight || 20, undefined, true));
      }
    } catch (error) {
      console.error('Error loading exercise defaults:', error);
      toast.error('Failed to load exercise defaults');
    }
  };

  // Update display values when unit changes or form data changes
  useEffect(() => {
    setDisplayWeight(convertWeight(editForm.defaults?.weight || 0));
    setDisplayIncrement(convertWeight(editForm.defaults?.weight_increment || 2.3));
    setDisplayRepIncrement(editForm.defaults?.rep_increment || 1);
    setDisplayBarWeight(convertWeight(editForm.defaults?.bar_weight || 20, undefined, true));
  }, [editForm.defaults?.weight, editForm.defaults?.weight_increment, editForm.defaults?.rep_increment, editForm.defaults?.bar_weight, unit]);

  // Handle weight change with unit conversion
  const handleWeightChange = (newWeight: number) => {
    const kgWeight = parseWeight(newWeight.toString());
    setDisplayWeight(convertWeight(kgWeight));
    setEditForm({
      ...editForm,
      defaults: {
        ...editForm.defaults,
        weight: kgWeight,
      },
    });
  };

  // Handle weight increment change with unit conversion
  const handleIncrementChange = (newIncrement: number) => {
    const kgIncrement = parseWeight(newIncrement.toString());
    setDisplayIncrement(convertWeight(kgIncrement));
    setEditForm({
      ...editForm,
      defaults: {
        ...editForm.defaults,
        weight_increment: kgIncrement,
      },
    });
  };

  // Handle rep increment change (no unit conversion needed)
  const handleRepIncrementChange = (newRepIncrement: number) => {
    setDisplayRepIncrement(newRepIncrement);
    setEditForm({
      ...editForm,
      defaults: {
        ...editForm.defaults,
        rep_increment: newRepIncrement,
      },
    });
  };

  // Handle bar weight change with unit conversion
  const handleBarWeightChange = (newBarWeight: number) => {
    const kgBarWeight = parseWeight(newBarWeight.toString(), true);
    setDisplayBarWeight(convertWeight(kgBarWeight, undefined, true));
    setEditForm({
      ...editForm,
      defaults: {
        ...editForm.defaults,
        bar_weight: kgBarWeight,
      },
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const handlePlateCalculatorClose = async () => {
    setShowPlateCalculator(false);
    await loadExerciseDefaults();
  };

  return (
    <div className="space-y-6">
      {/* Header with Save/Cancel Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Basic Info Section */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={editForm.name || ''}
            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Equipment Type</label>
            <select
              value={editForm.equipment_type?.id || ''}
              onChange={e => {
                const type = equipmentTypes.find(t => t.id === e.target.value);
                setEditForm({ ...editForm, equipment_type: type });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select equipment</option>
              {equipmentTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.emoji} {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Body Part</label>
            <select
              value={editForm.body_part?.id || ''}
              onChange={e => {
                const part = bodyParts.find(p => p.id === e.target.value);
                setEditForm({ ...editForm, body_part: part });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select body part</option>
              {bodyParts.map(part => (
                <option key={part.id} value={part.id}>{part.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={editForm.description || ''}
            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows={2}
          />
        </div>

        {/* Exercise Parameters Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Exercise Parameters</h3>
          
          <div className="space-y-3">
            {/* Sets */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500">Sets</label>
              <input
                type="number"
                min="1"
                value={editForm.defaults?.sets || 3}
                onChange={e => setEditForm({
                  ...editForm,
                  defaults: {
                    ...editForm.defaults,
                    sets: parseInt(e.target.value),
                  },
                })}
                className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
              />
            </div>

            {/* Reps */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500">Reps</label>
              <input
                type="number"
                min="1"
                value={editForm.defaults?.reps || 10}
                onChange={e => setEditForm({
                  ...editForm,
                  defaults: {
                    ...editForm.defaults,
                    reps: parseInt(e.target.value),
                  },
                })}
                className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
              />
            </div>

            {/* Weight */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500">Weight</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={displayWeight}
                  onChange={e => handleWeightChange(parseFloat(e.target.value) || 0)}
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                />
                <div className="text-sm text-gray-500 w-8">{unit}</div>
                {editForm.is_plate_loaded && (
                  <button
                    onClick={() => setShowPlateCalculator(true)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                    title="Calculate plates"
                  >
                    <Scale className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Weight Increment */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500">Weight Increment</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={displayIncrement}
                  onChange={e => handleIncrementChange(parseFloat(e.target.value) || 0)}
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                />
                <div className="text-sm text-gray-500 w-8">{unit}</div>
              </div>
            </div>

            {/* Rep Increment */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500">Rep Increment</label>
              <input
                type="number"
                min="1"
                step="1"
                value={displayRepIncrement}
                onChange={e => handleRepIncrementChange(parseInt(e.target.value) || 1)}
                className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
              />
            </div>

            {/* Bar Weight - Only show for plate loaded exercises */}
            {editForm.is_plate_loaded && (
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-500">Bar Weight</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step={unit === 'kg' ? "0.01" : "0.1"}
                    value={displayBarWeight}
                    onChange={e => handleBarWeightChange(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                  />
                  <div className="text-sm text-gray-500 w-8">{unit}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Exercise Type Toggles */}
        <div className="space-y-4 border-t border-b py-4">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editForm.is_compound || false}
                onChange={e => setEditForm({ ...editForm, is_compound: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Compound Exercise</span>
            </label>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editForm.is_plate_loaded || false}
                onChange={e => setEditForm({ ...editForm, is_plate_loaded: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Plate Loaded Exercise</span>
            </label>
            <p className="mt-1 text-xs text-gray-500 ml-6">
              Enable plate calculator for barbell and plate-loaded exercises
            </p>
          </div>
        </div>

        {/* Muscles Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Muscles Worked</label>
          <div className="grid grid-cols-2 gap-6 border rounded-md p-4">
            {Object.entries(groupedMuscles).map(([category, muscles]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category}</h3>
                
                {/* Radio button labels at the top */}
                <div className="flex text-xs text-gray-500 pl-8 mb-2">
                  <div className="w-12">n/a</div>
                  <div className="w-12">Pri</div>
                  <div className="w-12">Sec</div>
                </div>

                <div className="space-y-2">
                  {muscles.map(muscle => {
                    const isSelected = selectedMuscleGroups.some(mg => mg.id === muscle.id);
                    const isPrimary = selectedMuscleGroups.some(
                      mg => mg.id === muscle.id && mg.is_primary
                    );
                    return (
                      <div key={muscle.id} className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`muscle-${muscle.id}`}
                            checked={!isSelected}
                            onChange={() => toggleMuscleGroup(muscle.id, false)}
                            className="h-3 w-3 text-gray-400 border-gray-300 focus:ring-gray-500"
                          />
                          <input
                            type="radio"
                            name={`muscle-${muscle.id}`}
                            checked={isSelected && isPrimary}
                            onChange={() => toggleMuscleGroup(muscle.id, true)}
                            className="h-3 w-3 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                          />
                          <input
                            type="radio"
                            name={`muscle-${muscle.id}`}
                            checked={isSelected && !isPrimary}
                            onChange={() => toggleMuscleGroup(muscle.id, false)}
                            className="h-3 w-3 text-indigo-400 border-gray-300 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="text-sm group relative">
                          {muscle.name}
                          {muscle.description && (
                            <div className="absolute left-0 bottom-full mb-1 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                              {muscle.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plate Calculator */}
        {showPlateCalculator && (
          <PlateCalculator
            weight={editForm.defaults?.weight || 0}
            onWeightChange={handleWeightChange}
            weightIncrement={editForm.defaults?.weight_increment || 2.3}
            isOpen={showPlateCalculator}
            onClose={handlePlateCalculatorClose}
            exerciseId={exerciseId}
            exerciseName={editForm.name}
          />
        )}
      </div>
    </div>
  );
};

export default ExerciseFormV2;