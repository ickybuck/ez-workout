import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { toKg } from '../lib/weight';

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

const STEPS = ['Units', 'Body weight', 'Plates'] as const;

interface Props {
  onDone: () => void;
}

/**
 * First run.
 *
 * Three screens that COLLECT rather than describe. A tour explaining the app is
 * forgotten by the time it matters; three settings that are wrong until someone
 * finds Settings cause visible, repeated harm — a plate calculator suggesting
 * 1.25 kg plates a gym does not own, weights shown in the wrong unit, bodyweight
 * exercises contributing nothing to volume.
 *
 * So this asks only for what cannot be guessed and has consequences, and each
 * step says what the answer is FOR. Everything else has a sensible default and
 * lives in Settings, which is also where all three of these can be changed.
 *
 * Body weight is skippable, and says so. It is genuinely optional, and a
 * required field asking a stranger their weight before they have seen anything
 * is a good way to lose them.
 */
const Onboarding: React.FC<Props> = ({ onDone }) => {
  const { user } = useAuth();
  const { setUnit } = useWeightUnit();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [unit, setLocalUnit] = useState<'kg' | 'lb'>('lb');
  const [bodyWeight, setBodyWeight] = useState('');
  const [platesKg, setPlatesKg] = useState<number[]>(KG_PLATES);
  const [platesLb, setPlatesLb] = useState<number[]>(LB_PLATES);

  const plates = unit === 'kg' ? platesKg : platesLb;
  const allPlates = unit === 'kg' ? KG_PLATES : LB_PLATES;

  const togglePlate = (plate: number) => {
    const next = plates.includes(plate)
      ? plates.filter((p) => p !== plate)
      : [...plates, plate].sort((a, b) => b - a);
    if (unit === 'kg') setPlatesKg(next);
    else setPlatesLb(next);
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Body weight is stored in kilograms like every other weight in the
      // schema, so it converts from the unit just chosen rather than from
      // whatever the store holds — setUnit has not been applied yet.
      const parsed = parseFloat(bodyWeight);
      const weight = Number.isFinite(parsed) && parsed > 0 ? toKg(parsed, unit) : null;

      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          weight_unit: unit,
          use_metric: unit === 'kg',
          weight,
          available_plates_kg: platesKg,
          available_plates_lb: platesLb,
          onboarded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) throw error;

      setUnit(unit);
      onDone();
      navigate('/dashboard/templates');
    } catch (error) {
      console.error('Error saving setup:', error);
      toast.error('Could not save your setup. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex-1 w-full max-w-md mx-auto px-6 py-10 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 flex-shrink-0 rounded-full bg-accent-soft flex items-center justify-center">
            <Dumbbell className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 flex gap-1.5">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-accent' : 'bg-surface-sunken'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1">
          {step === 0 && (
            <>
              <h1 className="text-2xl font-bold text-content mb-2">Kilograms or pounds?</h1>
              <p className="text-sm text-content-muted mb-4">
                Every weight in the app is shown this way. You can change it later
                without losing anything — weights are stored once and converted for
                display.
              </p>
              <div className="space-y-3">
                {(['lb', 'kg'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setLocalUnit(u)}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-lg border text-left transition-colors ${
                      unit === u
                        ? 'border-accent bg-accent-soft'
                        : 'border-edge-strong hover:bg-surface-raised'
                    }`}
                  >
                    <span>
                      <span className="block font-medium text-content">
                        {u === 'lb' ? 'Pounds' : 'Kilograms'}
                      </span>
                      <span className="block text-sm text-content-muted">
                        {u === 'lb' ? '225 lb' : '100 kg'}
                      </span>
                    </span>
                    {unit === u && <Check className="h-5 w-5 text-accent" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-content mb-2">How much do you weigh?</h1>
              <p className="text-sm text-content-muted mb-4">
                Only used so bodyweight exercises — push-ups, chin-ups, dips — count
                toward your volume instead of registering as zero. Skip it if you
                would rather not; you can add it in Settings any time.
              </p>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  placeholder={unit === 'lb' ? '180' : '82'}
                  className="w-full px-4 py-4 pr-14 text-lg rounded-lg border border-edge-strong focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-content-subtle">
                  {unit}
                </span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold text-content mb-2">
                Which plates does your gym have?
              </h1>
              <p className="text-sm text-content-muted mb-4">
                This is what lets the app tell you how to load a bar. Turn off
                anything your gym does not stock — suggesting a plate you cannot
                find is worse than suggesting a heavier one you can.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {allPlates.map((plate) => {
                  const on = plates.includes(plate);
                  return (
                    <button
                      key={plate}
                      onClick={() => togglePlate(plate)}
                      className={`px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                        on
                          ? 'bg-accent text-content-inverse'
                          : 'bg-surface-sunken text-content-muted'
                      }`}
                    >
                      {plate} {unit}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-content-subtle mt-3">{plates.length} selected</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm text-content-muted hover:text-content"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {step === 1 && !bodyWeight && (
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 text-sm text-content-muted hover:text-content"
              >
                Skip
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-content-inverse hover:bg-accent-hover transition-colors"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-content-inverse hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Done'}
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
