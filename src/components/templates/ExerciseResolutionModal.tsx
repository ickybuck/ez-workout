import React, { useState, useMemo } from 'react';
import { X, Search, AlertTriangle, CheckCircle, SkipForward } from 'lucide-react';
import { UnresolvedExercise, AvailableExercise } from '../../lib/templateImport';

export type ResolutionEntry = { exerciseId: string | null; skipped: boolean };

interface ExerciseResolutionModalProps {
  unresolved: UnresolvedExercise[];
  availableExercises: AvailableExercise[];
  onConfirm: (resolutions: Record<string, string | null>) => void;
  onCancel: () => void;
}

function resolutionKey(u: UnresolvedExercise): string {
  return `${u.template_name}::${u.original_name}::${u.order_index}`;
}

const ExerciseResolutionModal: React.FC<ExerciseResolutionModalProps> = ({
  unresolved,
  availableExercises,
  onConfirm,
  onCancel,
}) => {
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [selections, setSelections] = useState<Record<string, string | null>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const resolvedCount = unresolved.filter((u) => {
    const key = resolutionKey(u);
    return selections[key] !== undefined || skipped.has(key);
  }).length;

  const allResolved = resolvedCount === unresolved.length;

  function getFiltered(key: string): AvailableExercise[] {
    const q = (searches[key] ?? '').toLowerCase();
    if (!q) return availableExercises.slice(0, 50);
    return availableExercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 50);
  }

  function handleSearch(key: string, value: string) {
    setSearches((prev) => ({ ...prev, [key]: value }));
    setSelections((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleSelect(key: string, exercise: AvailableExercise) {
    setSelections((prev) => ({ ...prev, [key]: exercise.id }));
    setSearches((prev) => ({ ...prev, [key]: exercise.name }));
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleSkip(key: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setSelections((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });
        setSearches((p) => ({ ...p, [key]: '' }));
      }
      return next;
    });
  }

  function handleConfirm() {
    const result: Record<string, string | null> = {};
    for (const u of unresolved) {
      const key = resolutionKey(u);
      if (skipped.has(key)) {
        result[key] = null;
      } else if (selections[key] !== undefined) {
        result[key] = selections[key];
      }
    }
    onConfirm(result);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, UnresolvedExercise[]>();
    for (const u of unresolved) {
      if (!map.has(u.template_name)) map.set(u.template_name, []);
      map.get(u.template_name)!.push(u);
    }
    return map;
  }, [unresolved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Resolve Exercises</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {resolvedCount} of {unresolved.length} resolved
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              These exercises from your file don't match any exercise in your library. Choose a substitute or skip each one to continue the import.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {Array.from(grouped.entries()).map(([templateName, items]) => (
            <div key={templateName}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {templateName}
              </p>
              <div className="space-y-4">
                {items.map((u) => {
                  const key = resolutionKey(u);
                  const isSkipped = skipped.has(key);
                  const isSelected = selections[key] !== undefined;
                  const filtered = getFiltered(key);

                  return (
                    <div key={key} className={`rounded-xl border p-4 transition-all ${isSkipped ? 'border-gray-200 bg-gray-50 opacity-60' : isSelected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.original_name}</p>
                          <p className="text-xs text-gray-400">Not found in your exercise library</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isSelected && !isSkipped && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <button
                            onClick={() => handleSkip(key)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isSkipped ? 'bg-gray-200 text-gray-600' : 'text-gray-500 hover:bg-gray-100'}`}
                            title={isSkipped ? 'Undo skip' : 'Skip this exercise'}
                          >
                            <SkipForward className="h-3 w-3" />
                            {isSkipped ? 'Undo' : 'Skip'}
                          </button>
                        </div>
                      </div>

                      {!isSkipped && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search your exercises..."
                            value={searches[key] ?? ''}
                            onChange={(e) => handleSearch(key, e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {searches[key] && !isSelected && filtered.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                              {filtered.map((ex) => (
                                <button
                                  key={ex.id}
                                  onClick={() => handleSelect(key, ex)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  {ex.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allResolved}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExerciseResolutionModal;
