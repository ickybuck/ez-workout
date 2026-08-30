import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

interface UnitsAndPlatesSectionProps {
  expanded: boolean;
  onToggle: () => void;
  weightUnit: 'kg' | 'lb';
  currentUnit: 'kg' | 'lb';
  availablePlatesKg: number[];
  availablePlatesLb: number[];
  onChange: (fields: Partial<{
    weight_unit: 'kg' | 'lb';
    available_plates_kg: number[];
    available_plates_lb: number[];
  }>) => void;
}

const UnitsAndPlatesSection: React.FC<UnitsAndPlatesSectionProps> = ({
  expanded,
  onToggle,
  weightUnit,
  currentUnit,
  availablePlatesKg,
  availablePlatesLb,
  onChange,
}) => {
  const handlePlateToggleKg = (plate: number) => {
    const isSelected = availablePlatesKg.includes(plate);
    onChange({
      available_plates_kg: isSelected
        ? availablePlatesKg.filter((p) => p !== plate)
        : [...availablePlatesKg, plate].sort((a, b) => b - a),
    });
  };

  const handlePlateToggleLb = (plate: number) => {
    const isSelected = availablePlatesLb.includes(plate);
    onChange({
      available_plates_lb: isSelected
        ? availablePlatesLb.filter((p) => p !== plate)
        : [...availablePlatesLb, plate].sort((a, b) => b - a),
    });
  };

  const handleReset = () => {
    onChange({
      available_plates_kg: [25, 20, 15, 10, 5, 2.5, 1.25],
      available_plates_lb: [45, 35, 25, 10, 5, 2.5],
    });
    toast.success('Reset to default plates');
  };

  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-content">Units & Plates</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-content-subtle" />
        ) : (
          <ChevronDown className="h-5 w-5 text-content-subtle" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-muted mb-2">Weight Unit</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={weightUnit === 'kg'}
                  onChange={() => onChange({ weight_unit: 'kg' })}
                  className="h-4 w-4 text-accent focus:ring-accent border-edge-strong"
                />
                <span className="ml-2 text-content">Kilograms (kg)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={weightUnit === 'lb'}
                  onChange={() => onChange({ weight_unit: 'lb' })}
                  className="h-4 w-4 text-accent focus:ring-accent border-edge-strong"
                />
                <span className="ml-2 text-content">Pounds (lb)</span>
              </label>
            </div>
            <p className="mt-1 text-sm text-content-subtle">
              {currentUnit === 'kg' ? 'Using metric units' : 'Using imperial units'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-content">Available Plates</h4>
                <p className="text-xs text-content-subtle mt-1">
                  Select which plates are available at your gym for the plate calculator
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-3 py-1 text-xs font-medium text-accent hover:text-accent-content hover:bg-accent-soft rounded-md transition-colors"
              >
                Reset to Default
              </button>
            </div>

            {weightUnit === 'kg' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {KG_PLATES.map((plate) => {
                    const isSelected = availablePlatesKg.includes(plate);
                    return (
                      <button
                        key={plate}
                        onClick={() => handlePlateToggleKg(plate)}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-accent text-content-inverse hover:bg-accent-hover'
                            : 'bg-surface-sunken text-content-muted hover:bg-surface-sunken'
                        }`}
                      >
                        {plate} kg
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-content-subtle mt-2">
                  Selected: {availablePlatesKg.length} plate{availablePlatesKg.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {LB_PLATES.map((plate) => {
                    const isSelected = availablePlatesLb.includes(plate);
                    return (
                      <button
                        key={plate}
                        onClick={() => handlePlateToggleLb(plate)}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-accent text-content-inverse hover:bg-accent-hover'
                            : 'bg-surface-sunken text-content-muted hover:bg-surface-sunken'
                        }`}
                      >
                        {plate} lb
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-content-subtle mt-2">
                  Selected: {availablePlatesLb.length} plate{availablePlatesLb.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitsAndPlatesSection;
