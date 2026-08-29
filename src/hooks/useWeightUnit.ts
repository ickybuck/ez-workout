import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { convert, format, formatVolume as formatVolumeIn, parseInput } from '../lib/weight';

interface WeightUnitStore {
  unit: 'kg' | 'lb';
  setUnit: (unit: 'kg' | 'lb') => void;
}

const useWeightUnitStore = create<WeightUnitStore>()(
  persist(
    (set) => ({
      unit: 'kg',
      setUnit: (unit) => set({ unit }),
    }),
    {
      name: 'weight-unit-storage',
    }
  )
);

export const useWeightUnit = () => {
  const { user } = useAuth();
  const { unit, setUnit } = useWeightUnitStore();

  useEffect(() => {
    const loadUserUnit = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('weight_unit')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data?.weight_unit) {
          setUnit(data.weight_unit as 'kg' | 'lb');
        }
      } catch (error) {
        console.error('Error loading user weight unit:', error);
      }
    };

    loadUserUnit();
  }, [user, setUnit]);

  /**
   * Convert weight between kg and lb.
   *
   * The two-mode signature is preserved because ~18 components depend on it:
   * with no targetUnit it converts a stored kilogram value into the display
   * unit; with one, it converts from the display unit into that unit.
   *
   * @param weight - Weight value to convert
   * @param targetUnit - Optional target unit. If not provided, converts to display unit
   * @param _isBarWeight - Unused. Bar weights no longer round differently now
   *   that storage carries 1 gram resolution; kept so call sites still compile.
   * @returns Converted weight value
   */
  const convertWeight = (
    weight: number,
    targetUnit?: 'kg' | 'lb',
    _isBarWeight: boolean = false,
  ): number => convert(weight, targetUnit ? unit : 'kg', targetUnit || unit);

  /**
   * Format a stored kilogram value for display in the user's unit.
   * @param weight - Weight in kg (database value)
   * @param includeUnit - Whether to include the unit in the output
   * @param _isBarWeight - Unused; see convertWeight
   */
  const formatWeight = (weight: number, includeUnit = true, _isBarWeight = false): string =>
    format(weight, unit, { includeUnit });

  /**
   * Parse weight input in the user's unit and convert to kg for storage.
   * @param input - Weight input string
   * @param _isBarWeight - Unused; see convertWeight
   * @returns Weight in kg for database storage
   */
  const parseWeight = (input: string, _isBarWeight = false): number =>
    parseInput(input, unit);

  /**
   * Format an aggregate volume. Distinct from formatWeight: a session total
   * runs to five figures, where formatWeight's decimals are noise.
   */
  const formatVolume = (kg: number, includeUnit = true): string =>
    formatVolumeIn(kg, unit, { includeUnit });

  return {
    unit,
    setUnit,
    convertWeight,
    formatWeight,
    formatVolume,
    parseWeight,
  };
};