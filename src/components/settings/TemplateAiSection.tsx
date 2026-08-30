import React, { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  FileJson,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { buildBundle } from '../../lib/templateBundleExport';
import { buildInstructionDocument } from '../../lib/templateInstructions';
import { formatIssueReport, parseBundle, type ValidationIssue } from '../../lib/templateBundle';
import {
  commitBundleImport,
  planImport,
  type ImportPlan,
} from '../../lib/templateBundleImport';

interface Props {
  expanded: boolean;
  onToggle: () => void;
}

function download(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Rebuilding templates by conversation.
 *
 * Three steps, shown as three steps because that is what it is: take a file to
 * a chat, talk about it, bring the answer back. The paste box is not a
 * convenience — on Android, getting a file out of a chat app and into an
 * installed PWA is the worst part of the loop, and selecting the reply is what
 * people will actually do.
 *
 * Nothing is written to the database until the review step has been seen. An
 * import that reported success while silently skipping four exercises is the
 * failure this app has already had once (EZ-02), so the counts shown are of
 * what will happen, and the counts reported afterwards are of what did.
 */
const TemplateAiSection: React.FC<Props> = ({ expanded, onToggle }) => {
  const { user } = useAuth();
  const { unit } = useWeightUnit();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [includePerformance, setIncludePerformance] = useState(false);
  const [busy, setBusy] = useState<'md' | 'json' | 'check' | 'import' | null>(null);
  const [pasted, setPasted] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [hideIds, setHideIds] = useState<Set<string>>(new Set());

  const reset = () => {
    setPlan(null);
    setIssues([]);
    setOverrides({});
    setHideIds(new Set());
  };

  const handleDownload = async (format: 'md' | 'json') => {
    if (!user) return;
    setBusy(format);
    try {
      const bundle = await buildBundle({ userId: user.id, unit, includePerformance });

      if (bundle.templates.length === 0) {
        toast.error('You have no templates to export yet.');
        return;
      }

      if (format === 'md') {
        download(
          buildInstructionDocument(bundle, { includePerformance }),
          `workout-templates-${today()}.md`,
          'text/markdown;charset=utf-8',
        );
      } else {
        download(
          JSON.stringify(bundle, null, 2),
          `workout-templates-${today()}.json`,
          'application/json',
        );
      }
      toast.success('Downloaded. Upload it to your AI chat and describe the changes you want.');
    } catch (error) {
      console.error('Template export failed:', error);
      toast.error('Could not build the export. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const check = useCallback(
    async (text: string) => {
      if (!user) return;
      reset();
      setBusy('check');
      try {
        const { bundle, issues: found } = parseBundle(text);
        setIssues(found);
        if (!bundle) return;

        const built = await planImport(user.id, bundle);
        setPlan(built);
      } catch (error) {
        console.error('Import check failed:', error);
        toast.error('Could not read that. Check the paste and try again.');
      } finally {
        setBusy(null);
      }
    },
    [user],
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const text = await file.text();
    setPasted(text);
    await check(text);
  };

  const handleImport = async () => {
    if (!user || !plan) return;
    setBusy('import');
    try {
      const result = await commitBundleImport({
        userId: user.id,
        plan,
        overrides,
        hideTemplateIds: Array.from(hideIds),
      });

      // Report what happened, not what was attempted.
      const parts = [
        `Added ${result.templatesCreated} template${result.templatesCreated === 1 ? '' : 's'}`,
        `${result.exercisesLinked} exercise${result.exercisesLinked === 1 ? '' : 's'}`,
      ];
      if (result.exercisesSkipped > 0) parts.push(`${result.exercisesSkipped} skipped`);
      if (result.templatesHidden > 0) parts.push(`${result.templatesHidden} old hidden`);
      toast.success(parts.join(' · '));

      setPasted('');
      reset();
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(formatIssueReport(issues));
      toast.success('Copied. Paste it back into the chat that made the file.');
    } catch {
      toast.error('Could not copy. Select the text above instead.');
    }
  };

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  /**
   * What this exercise will actually resolve to.
   *
   * The presence of the key decides, not its truthiness. Choosing "Skip" stores
   * null, and `overrides[name] ?? auto` would read that null as "nothing chosen"
   * and fall straight back to the automatic match — so the dropdown would spring
   * back to the exercise the user just rejected, and the count would be wrong.
   */
  const effectiveId = (name: string, auto: string | null): string | null =>
    name in overrides ? overrides[name] : auto;

  const unresolvedCount = plan
    ? plan.resolutions.filter((r) => !effectiveId(r.name, r.exerciseId)).length
    : 0;

  return (
    <div className="pt-6 border-t">
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <h3 className="text-lg font-medium text-content">Rebuild Templates with AI</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-content-subtle" />
        ) : (
          <ChevronDown className="h-5 w-5 text-content-subtle" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-content-subtle">
            Download your templates with instructions, talk them through with an AI chat, then bring
            the result back here. Importing only ever <span className="font-medium text-content-muted">adds</span>{' '}
            templates — nothing is overwritten or deleted.
          </p>

          {/* Step 1 */}
          <div>
            <p className="text-sm font-medium text-content-muted mb-1">1. Take it to the chat</p>
            <p className="text-xs text-content-subtle mb-3">
              The document holds your templates, your exercise list, and the rules the AI needs to
              give you something this app can read back. Weights are in{' '}
              <span className="font-medium text-content-muted">{unit}</span>.
            </p>

            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePerformance}
                onChange={(e) => setIncludePerformance(e.target.checked)}
                className="mt-0.5 rounded border-edge-strong text-accent focus:ring-accent"
              />
              <span className="text-xs text-content-muted">
                Include my recent performance
                <span className="block text-content-subtle">
                  Real weights, reps and failed-rep rates from the last six months, so the AI can set
                  sensible loads instead of guessing. This is your training data — it leaves the app
                  only if you tick this.
                </span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDownload('md')}
                disabled={!!busy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-edge bg-surface-raised text-content-muted hover:bg-surface hover:border-edge-strong transition-all disabled:opacity-50 shadow-sm"
              >
                {busy === 'md' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-accent" />
                )}
                Instructions + templates
              </button>
              <button
                onClick={() => handleDownload('json')}
                disabled={!!busy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-edge bg-surface-raised text-content-muted hover:bg-surface hover:border-edge-strong transition-all disabled:opacity-50 shadow-sm"
              >
                {busy === 'json' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4 text-content-subtle" />
                )}
                Data only
              </button>
            </div>
            <p className="text-xs text-content-subtle mt-1.5 text-center">
              Use the first one unless you know you want the second.
            </p>
          </div>

          {/* Step 2 */}
          <div className="pt-4 border-t border-edge">
            <p className="text-sm font-medium text-content-muted mb-1">2. Bring the answer back</p>
            <p className="text-xs text-content-subtle mb-3">
              Paste the whole reply — the prose around the code block is fine, it gets ignored.
            </p>

            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              placeholder='Paste the reply here, including the ```json block…'
              className="block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent text-sm font-mono"
            />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={() => check(pasted)}
                disabled={!!busy || !pasted.trim()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface-inverse text-content-on-inverse hover:bg-surface-inverse transition-all disabled:opacity-40 shadow-sm"
              >
                {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Check it
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!!busy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-edge bg-surface-raised text-content-muted hover:bg-surface hover:border-edge-strong transition-all disabled:opacity-50 shadow-sm"
              >
                <Upload className="h-4 w-4 text-content-subtle" />
                Upload a file
              </button>
            </div>
          </div>

          {/* Problems */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-critical bg-critical-soft p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-critical" />
                <p className="text-sm font-medium text-critical-content">
                  This file can’t be imported ({errors.length} problem{errors.length === 1 ? '' : 's'})
                </p>
              </div>
              <ul className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                {errors.map((issue, i) => (
                  <li key={i} className="text-xs text-critical">
                    <span className="font-mono text-critical-content">{issue.path}</span> — {issue.message}
                  </li>
                ))}
              </ul>
              <button
                onClick={copyReport}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-surface-raised border border-critical text-critical hover:bg-critical-soft transition-colors"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copy report for the chat
              </button>
              <p className="text-xs text-critical mt-2">
                Paste it back and it will fix all of these at once.
              </p>
            </div>
          )}

          {/* Review */}
          {plan && (
            <div className="rounded-lg border border-edge bg-surface p-3 space-y-4">
              <div>
                <p className="text-sm font-medium text-content">
                  3. Review — nothing has been saved yet
                </p>
                <p className="text-xs text-content-subtle mt-0.5">
                  {plan.bundle.templates.length} template
                  {plan.bundle.templates.length === 1 ? '' : 's'} to add, with weights read as{' '}
                  <span className="font-medium">{plan.bundle.weight_unit}</span>.
                </p>
              </div>

              {warnings.length > 0 && (
                <ul className="space-y-1">
                  {warnings.map((issue, i) => (
                    <li key={i} className="text-xs text-caution">
                      <span className="font-mono text-caution-content">{issue.path}</span> — {issue.message}
                    </li>
                  ))}
                </ul>
              )}

              <ul className="space-y-1">
                {plan.bundle.templates.map((template) => (
                  <li key={template.name} className="text-xs text-content-muted">
                    <span className="font-medium">{template.name}</span>{' '}
                    <span className="text-content-subtle">
                      — {template.category}, {template.exercises.length} exercises
                    </span>
                  </li>
                ))}
              </ul>

              {/* Exercises the file named that nothing matched */}
              {plan.resolutions.some((r) => !r.exerciseId || r.fuzzy) && (
                <div>
                  <p className="text-xs font-medium text-content-muted mb-1.5">Exercise names</p>
                  <div className="space-y-2">
                    {plan.resolutions
                      .filter((r) => !r.exerciseId || r.fuzzy)
                      .map((resolution) => {
                        const current = effectiveId(resolution.name, resolution.exerciseId) ?? '';
                        return (
                          <div key={resolution.name} className="flex items-center gap-2">
                            <span className="text-xs text-content-muted flex-1 truncate" title={resolution.name}>
                              {resolution.name}
                              {resolution.fuzzy && (
                                <span className="text-caution"> → {resolution.matchedName}</span>
                              )}
                            </span>
                            <select
                              value={current}
                              onChange={(e) =>
                                setOverrides((prev) => ({
                                  ...prev,
                                  [resolution.name]: e.target.value || null,
                                }))
                              }
                              className="text-xs px-2 py-1 border border-edge-strong rounded bg-surface-raised text-content-muted max-w-[55%]"
                            >
                              <option value="">Skip this exercise</option>
                              {plan.availableExercises.map((exercise) => (
                                <option key={exercise.id} value={exercise.id}>
                                  {exercise.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                  </div>
                  {unresolvedCount > 0 && (
                    <p className="text-xs text-caution mt-1.5">
                      {unresolvedCount} will be left out of the new templates.
                    </p>
                  )}
                </div>
              )}

              {/* Name collisions */}
              {plan.collisions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-content-muted mb-1">Already have these names</p>
                  <p className="text-xs text-content-subtle mb-2">
                    The new ones are added either way. Hiding the old one keeps its workout history
                    but takes it off your list.
                  </p>
                  <div className="space-y-1.5">
                    {plan.collisions.map((collision) => (
                      <label key={collision.existingId} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hideIds.has(collision.existingId)}
                          onChange={(e) =>
                            setHideIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(collision.existingId);
                              else next.delete(collision.existingId);
                              return next;
                            })
                          }
                          className="rounded border-edge-strong text-accent focus:ring-accent"
                        />
                        <span className="text-xs text-content-muted">
                          Hide the old “{collision.templateName}”
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises the AI wants added */}
              {plan.bundle.proposed_exercises.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-content-muted mb-1">
                    New exercises suggested — not added
                  </p>
                  <p className="text-xs text-content-subtle mb-2">
                    Add these in the exercise library first if you want them, then import again.
                  </p>
                  <ul className="space-y-1">
                    {plan.bundle.proposed_exercises.map((proposed) => (
                      <li key={proposed.name} className="text-xs text-content-muted">
                        <span className="font-medium">{proposed.name}</span>
                        {proposed.reason && <span className="text-content-subtle"> — {proposed.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleImport}
                  disabled={!!busy}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-content-inverse hover:bg-accent-hover transition-all disabled:opacity-40 shadow-sm"
                >
                  {busy === 'import' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Add {plan.bundle.templates.length} template
                  {plan.bundle.templates.length === 1 ? '' : 's'}
                </button>
                <button
                  onClick={reset}
                  disabled={!!busy}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-edge bg-surface-raised text-content-muted hover:bg-surface transition-all disabled:opacity-50 shadow-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.md,.txt"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

export default TemplateAiSection;
