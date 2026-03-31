import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
   * Convert weight between kg and lb
   * @param weight - Weight value to convert
   * @param targetUnit - Optional target unit. If not provided, converts to display unit
   * @param isBarWeight - Whether this is a bar weight conversion (uses different rounding)
   * @returns Converted weight value
   */
  const convertWeight = (weight: number, targetUnit?: 'kg' | 'lb', isBarWeight: boolean = false): number => {
    const from = targetUnit ? unit : 'kg';
    const to = targetUnit || unit;

    if (from === to) return weight;

    // Always convert using the exact conversion factor
    const CONVERSION_FACTOR = 2.20462262185;
    
    // First convert to kg if we're not already in kg
    const weightInKg = from === 'kg' ? weight : weight / CONVERSION_FACTOR;
    
    // Then convert to target unit if needed
    const converted = to === 'kg' ? weightInKg : weightInKg * CONVERSION_FACTOR;

    if (isBarWeight) {
      // For bar weights, use higher precision but don't force to standard weights
      return to === 'kg' 
        ? Math.round(converted * 100) / 100  // 2 decimal places for kg
        : Math.round(converted * 10) / 10;   // 1 decimal place for lb
    }
    
    // Regular weight rounding:
    // - kg: 1 decimal place (0.1 kg precision)
    // - lb: 0 decimal places (1 lb precision)
    return to === 'kg' 
      ? Math.round(converted * 10) / 10
      : Math.round(converted);
  };

  /**
   * Format weight value with unit
   * @param weight - Weight in kg (database value)
   * @param includeUnit - Whether to include the unit in the output
   * @param isBarWeight - Whether this is a bar weight
   * @returns Formatted weight string
   */
  const formatWeight = (weight: number, includeUnit = true, isBarWeight = false): string => {
    const converted = convertWeight(weight, undefined, isBarWeight);
    const formatted = isBarWeight
      ? (unit === 'kg' ? converted.toFixed(2) : converted.toFixed(1))
      : (unit === 'kg' ? converted.toFixed(1) : converted.toString());
    return includeUnit ? `${formatted} ${unit}` : formatted;
  };

  /**
   * Parse weight input and convert to kg for storage
   * @param input - Weight input string
   * @param isBarWeight - Whether this is a bar weight
   * @returns Weight in kg for database storage
   */
  const parseWeight = (input: string, isBarWeight = false): number => {
    const value = parseFloat(input);
    if (isNaN(value)) return 0;
    
    // If we're already in kg, just return the value with appropriate precision
    if (unit === 'kg') {
      return isBarWeight 
        ? Math.round(value * 100) / 100  // 2 decimal places for bar weights
        : Math.round(value * 10) / 10;   // 1 decimal place for regular weights
    }
    
    // Convert from lb to kg using exact conversion
    const kgValue = value / 2.20462262185;
    
    // Round appropriately for storage
    return isBarWeight
      ? Math.round(kgValue * 100) / 100  // 2 decimal places for bar weights
      : Math.round(kgValue * 10) / 10;   // 1 decimal place for regular weights
  };

  return {
    unit,
    setUnit,
    convertWeight,
    formatWeight,
    parseWeight,
  };
};