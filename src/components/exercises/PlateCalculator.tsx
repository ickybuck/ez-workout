import React, { useState, useEffect } from 'react';
import { Info, X, Plus, Minus, Scale } from 'lucide-react';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { PlateConfiguration } from '../../types/exercise';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface PlateCalculatorProps {
  weight: number; // Weight in kg
  onWeightChange: (weight: number) => void; // Weight in kg
  weightIncrement: number; // Weight in kg
  isOpen: boolean;
  onClose: () => void;
  exerciseId?: string;
  exerciseName?: string;
  availablePlatesKg?: number[];
  availablePlatesLb?: number[];
}

const PlateCalculator: React.FC<PlateCalculatorProps> = ({
  weight,
  onWeightChange,
  weightIncrement,
  isOpen,
  onClose,
  exerciseId,
  exerciseName,
  availablePlatesKg = [25, 20, 15, 10, 5, 2.5, 1.25],
  availablePlatesLb = [45, 35, 25, 10, 5, 2.5],
}) => {
  const { unit, convertWeight, parseWeight, formatWeight } = useWeightUnit();
  const [localWeight, setLocalWeight] = useState(convertWeight(weight));
  const [localWeightIncrement, setLocalWeightIncrement] = useState(convertWeight(weightIncrement));
  const [plateConfig, setPlateConfig] = useState<PlateConfiguration | null>(null);
  const [barWeight, setBarWeight] = useState(0);
  const [initialBarWeight, setInitialBarWeight] = useState(0);
  const [initialWeightIncrement, setInitialWeightIncrement] = useState(convertWeight(weightIncrement));
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Convert weight increment to display unit
  const displayIncrement = convertWeight(weightIncrement);

  // Available plate weights in current unit (sorted in descending order)
  const AVAILABLE_PLATES = unit === 'kg'
    ? [...availablePlatesKg].sort((a, b) => b - a)
    : [...availablePlatesLb].sort((a, b) => b - a);

  // Load bar weight and weight increment from exercise defaults
  useEffect(() => {
    const loadExerciseDefaults = async () => {
      if (!exerciseId) {
        const defaultBarWeight = getDefaultBarWeight();
        setBarWeight(defaultBarWeight);
        setInitialBarWeight(defaultBarWeight);
        const defaultIncrement = convertWeight(2.3);
        setLocalWeightIncrement(defaultIncrement);
        setInitialWeightIncrement(defaultIncrement);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('exercise_defaults')
          .select('bar_weight, weight_increment')
          .eq('exercise_id', exerciseId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading exercise defaults:', error);
        }

        let displayBarWeight: number;
        let displayWeightIncrement: number;

        if (data && data.bar_weight !== null) {
          displayBarWeight = convertWeight(data.bar_weight, undefined, true);
        } else {
          displayBarWeight = getDefaultBarWeight();
        }

        if (data && data.weight_increment !== null) {
          displayWeightIncrement = convertWeight(data.weight_increment);
        } else {
          displayWeightIncrement = convertWeight(2.3);
        }

        setBarWeight(displayBarWeight);
        setInitialBarWeight(displayBarWeight);
        setLocalWeightIncrement(displayWeightIncrement);
        setInitialWeightIncrement(displayWeightIncrement);
      } catch (error) {
        console.error('Error loading exercise defaults:', error);
        const defaultBarWeight = getDefaultBarWeight();
        setBarWeight(defaultBarWeight);
        setInitialBarWeight(defaultBarWeight);
        const defaultIncrement = convertWeight(2.3);
        setLocalWeightIncrement(defaultIncrement);
        setInitialWeightIncrement(defaultIncrement);
      }
    };

    loadExerciseDefaults();
  }, [exerciseId, unit]);

  const getDefaultBarWeight = () => {
    const isSmithMachine = exerciseName?.toLowerCase().includes('smith') ?? false;

    if (isSmithMachine) {
      return convertWeight(11.34, undefined, true);
    }

    return convertWeight(20, undefined, true);
  };

  useEffect(() => {
    const displayWeight = convertWeight(weight);
    setLocalWeight(displayWeight);
    calculatePlates(displayWeight);
  }, [weight, unit, barWeight]);

  // Check if anything has changed
  useEffect(() => {
    const hasWeightChanged = localWeight !== convertWeight(weight);
    const hasBarWeightChanged = barWeight !== initialBarWeight;
    const hasIncrementChanged = localWeightIncrement !== initialWeightIncrement;
    setIsDirty(hasWeightChanged || hasBarWeightChanged || hasIncrementChanged);
  }, [localWeight, barWeight, localWeightIncrement, weight, initialBarWeight, initialWeightIncrement]);

  const calculatePlates = (targetWeight: number) => {
    const weightPerSide = Math.max(0, (targetWeight - barWeight) / 2);
    
    if (weightPerSide < 0) {
      setPlateConfig(null);
      return;
    }

    const plates: { weight: number; count: number }[] = [];
    let remainingWeight = weightPerSide;

    for (const plateWeight of AVAILABLE_PLATES) {
      if (remainingWeight >= plateWeight) {
        const count = Math.floor(remainingWeight / plateWeight);
        plates.push({ weight: plateWeight, count });
        remainingWeight -= plateWeight * count;
      }
    }

    setPlateConfig({
      plates,
      barWeight,
      totalWeight: targetWeight,
    });
  };

  const handleWeightChange = (increment: boolean) => {
    const newWeight = increment 
      ? localWeight + localWeightIncrement 
      : Math.max(barWeight, localWeight - localWeightIncrement);
    
    setLocalWeight(newWeight);
    calculatePlates(newWeight);
  };

  const handleWeightInput = (value: string) => {
    const parsedWeight = parseFloat(value) || 0;
    const newWeight = Math.max(barWeight, parsedWeight);
    setLocalWeight(newWeight);
    calculatePlates(newWeight);
  };

  const handleBarWeightChange = async (value: string) => {
    const newBarWeight = parseFloat(value) || 0;
    setBarWeight(newBarWeight);
    calculatePlates(localWeight);
  };

  const handleWeightIncrementChange = (value: string) => {
    const newIncrement = parseFloat(value) || 0;
    setLocalWeightIncrement(Math.max(0.1, newIncrement)); // Minimum increment of 0.1
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert values to kg for storage
      const kgWeight = parseWeight(localWeight.toString());
      const kgBarWeight = parseWeight(barWeight.toString(), true);
      const kgWeightIncrement = parseWeight(localWeightIncrement.toString());
      
      // Update exercise defaults with all values
      if (exerciseId) {
        const { error } = await supabase
          .from('exercise_defaults')
          .update({ 
            weight: kgWeight,
            bar_weight: kgBarWeight,
            weight_increment: kgWeightIncrement,
            updated_at: new Date().toISOString()
          })
          .eq('exercise_id', exerciseId);

        if (error) throw error;

        // Update all template exercises that use this exercise
        const { error: templateError } = await supabase
          .from('template_exercises')
          .update({ 
            default_weight: kgWeight,
            updated_at: new Date().toISOString()
          })
          .eq('exercise_id', exerciseId);

        if (templateError) throw templateError;
      }

      // Update initial values to reflect saved state
      setInitialBarWeight(barWeight);
      setInitialWeightIncrement(localWeightIncrement);

      // Only call onWeightChange after successful database update
      onWeightChange(kgWeight);
      onClose();
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
    const displayWeight = convertWeight(weight);
    setLocalWeight(displayWeight);
    setBarWeight(initialBarWeight);
    setLocalWeightIncrement(initialWeightIncrement);
    calculatePlates(displayWeight);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Plate Calculator</h3>
            {exerciseName && (
              <p className="text-sm text-gray-500 mt-1">{exerciseName}</p>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Weight Display and Controls */}
        <div className="space-y-6">
          {/* Total Weight */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Total Weight</div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleWeightChange(false)}
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
              >
                <Minus className="h-5 w-5" />
              </button>
              <div 
                className="text-2xl font-mono font-semibold text-gray-900 tabular-nums w-24 text-center"
                onClick={() => setIsEditing(true)}
              >
                {isEditing ? (
                  <input
                    type="number"
                    value={localWeight}
                    onChange={(e) => handleWeightInput(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditing(false);
                      }
                    }}
                    className="w-full text-center bg-gray-50 border border-gray-300 rounded focus:border-indigo-500 focus:ring-indigo-500"
                    autoFocus
                    step={localWeightIncrement}
                    min={barWeight}
                  />
                ) : (
                  <div className="cursor-text">
                    {localWeight}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleWeightChange(true)}
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Bar Weight */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Bar Weight</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={barWeight}
                onChange={(e) => handleBarWeightChange(e.target.value)}
                step={localWeightIncrement}
                min="0"
                className="w-24 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg tabular-nums"
              />
              <div className="text-sm text-gray-500 w-8">{unit}</div>
            </div>
          </div>

          {/* Weight Increment */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500">Weight Increment</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localWeightIncrement}
                onChange={(e) => handleWeightIncrementChange(e.target.value)}
                step="0.1"
                min="0.1"
                className="w-24 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg tabular-nums"
              />
              <div className="text-sm text-gray-500 w-8">{unit}</div>
            </div>
          </div>

          {/* Plates Per Side */}
          {plateConfig && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Plates Per Side</div>
              {plateConfig.plates.map(({ weight, count }) => (
                <div
                  key={weight}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: count }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-8 bg-indigo-600 rounded"
                          style={{
                            opacity: 0.3 + (0.7 * weight) / (unit === 'kg' ? 20 : 45),
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-gray-900">
                      {count} × {weight}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{unit}</div>
                </div>
              ))}
            </div>
          )}

          {!plateConfig && (
            <div className="text-center text-gray-500 py-4">
              Weight is less than the bar weight
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlateCalculator;