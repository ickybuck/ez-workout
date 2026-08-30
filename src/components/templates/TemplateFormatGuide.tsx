import React, { useState } from 'react';
import { X, Copy, Check, Download, FileJson, FileText } from 'lucide-react';
import { buildSampleJSON, buildSampleCSV } from '../../lib/templateExport';

function triggerDownload(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const AI_PROMPT = `You are helping me create or modify workout templates for a fitness app.

The app accepts template files in two formats: JSON and CSV.

---

JSON FORMAT (recommended for AI generation):

The file must be a JSON object with this exact structure:

{
  "schema_version": "1.0",
  "exported_at": "<ISO 8601 timestamp>",
  "templates": [
    {
      "name": "Template Name",
      "description": "Optional description or null",
      "template_type": "regular",
      "category": "Upper Body",
      "exercises": [
        {
          "order_index": 0,
          "exercise_name": "Exact Exercise Name",
          "default_sets": 3,
          "default_reps": 10,
          "default_weight": 60
        }
      ]
    }
  ]
}

Field rules:
- "schema_version" must be "1.0"
- "template_type" must be exactly "regular" or "superset"
- "category" must be exactly one of: "Upper Body", "Lower Body", "Core Focused", "Whole Body"
- "order_index" starts at 0 and increments by 1 for each exercise in a template
- "default_weight" is in kilograms (kg)
- "exercise_name" must match an exercise that exists in my library (I will map any mismatches during import)

---

CSV FORMAT:

The first row must be this exact header (case-insensitive):
Template Name,Description,Template Type,Category,Exercise Order,Exercise Name,Default Sets,Default Reps,Default Weight (kg)

Each subsequent row represents one exercise in one template. Repeat the template fields on every row.

Allowed values:
- Template Type: regular or superset
- Category: Upper Body | Lower Body | Core Focused | Whole Body
- Default Weight (kg): number in kg

---

Please generate a valid file in JSON format using the rules above.`;

interface TemplateFormatGuideProps {
  onClose: () => void;
}

type Tab = 'json' | 'csv' | 'ai';

const TemplateFormatGuide: React.FC<TemplateFormatGuideProps> = ({ onClose }) => {
  const [tab, setTab] = useState<Tab>('json');
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const sampleJSON = buildSampleJSON();
  const sampleCSV = buildSampleCSV();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-edge flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-content">Import Format Guide</h2>
            <p className="text-xs text-content-subtle mt-0.5">Reference for creating or editing template files</p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-content-subtle hover:text-content-muted hover:bg-surface-sunken rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-edge px-6 flex-shrink-0">
          {([
            { key: 'json', label: 'JSON Format' },
            { key: 'csv', label: 'CSV Format' },
            { key: 'ai', label: 'AI Prompt' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-accent text-content'
                  : 'border-transparent text-content-subtle hover:text-content-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {tab === 'json' && (
            <div className="space-y-5">
              <p className="text-sm text-content-muted">
                JSON is the recommended format for creating templates with AI. It supports all fields and is easy to validate.
              </p>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-content">Schema</h3>
                <div className="bg-surface rounded-xl p-4 space-y-2 text-xs font-mono leading-relaxed text-content-muted overflow-x-auto">
                  <p><span className="text-accent">"schema_version"</span>: <span className="text-positive">"1.0"</span> <span className="text-content-subtle">(required, always "1.0")</span></p>
                  <p><span className="text-accent">"exported_at"</span>: <span className="text-positive">"2024-01-01T00:00:00.000Z"</span> <span className="text-content-subtle">(ISO 8601)</span></p>
                  <p><span className="text-accent">"templates"</span>: <span className="text-content-subtle">array of template objects</span></p>
                </div>

                <h3 className="text-sm font-semibold text-content pt-1">Template object fields</h3>
                <table className="w-full text-xs border border-edge rounded-lg overflow-hidden">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Field</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Allowed values</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {[
                      ['name', 'string', 'Any text', 'Yes'],
                      ['description', 'string | null', 'Any text or null', 'No'],
                      ['template_type', 'string', '"regular" or "superset"', 'Yes'],
                      ['category', 'string', '"Upper Body", "Lower Body", "Core Focused", "Whole Body"', 'Yes'],
                      ['exercises', 'array', 'Array of exercise objects', 'Yes'],
                    ].map(([field, type, allowed, req]) => (
                      <tr key={field} className="hover:bg-surface">
                        <td className="px-3 py-2 font-mono text-accent-content">{field}</td>
                        <td className="px-3 py-2 text-content-subtle">{type}</td>
                        <td className="px-3 py-2 text-content-muted">{allowed}</td>
                        <td className="px-3 py-2">{req === 'Yes' ? <span className="text-critical font-medium">Yes</span> : <span className="text-content-subtle">No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="text-sm font-semibold text-content pt-1">Exercise object fields</h3>
                <table className="w-full text-xs border border-edge rounded-lg overflow-hidden">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Field</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {[
                      ['order_index', 'number', 'Starts at 0, increments by 1'],
                      ['exercise_name', 'string', 'Must match an exercise in your library'],
                      ['default_sets', 'number', 'Positive integer'],
                      ['default_reps', 'number', 'Positive integer'],
                      ['default_weight', 'number', 'In kilograms (kg)'],
                    ].map(([field, type, notes]) => (
                      <tr key={field} className="hover:bg-surface">
                        <td className="px-3 py-2 font-mono text-accent-content">{field}</td>
                        <td className="px-3 py-2 text-content-subtle">{type}</td>
                        <td className="px-3 py-2 text-content-muted">{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-content">Sample File</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(sampleJSON)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-content-muted hover:bg-surface-sunken transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => triggerDownload(sampleJSON, 'sample-template.json', 'application/json')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-content-muted hover:bg-surface-sunken transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
                <pre className="bg-surface-overlay text-positive rounded-xl p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre">
                  {sampleJSON}
                </pre>
              </div>
            </div>
          )}

          {tab === 'csv' && (
            <div className="space-y-5">
              <p className="text-sm text-content-muted">
                CSV works well for editing templates in a spreadsheet application. Each row represents one exercise within a template.
              </p>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-content">Column Reference</h3>
                <table className="w-full text-xs border border-edge rounded-lg overflow-hidden">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Column</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Allowed values</th>
                      <th className="px-3 py-2 text-left font-semibold text-content-muted">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {[
                      ['Template Name', 'Any text', 'Repeat on every row for the same template'],
                      ['Description', 'Any text or empty', 'Optional'],
                      ['Template Type', 'regular | superset', 'Exact values only'],
                      ['Category', 'Upper Body | Lower Body | Core Focused | Whole Body', 'Exact values only'],
                      ['Exercise Order', 'Number (0, 1, 2...)', 'Optional, auto-assigned if missing'],
                      ['Exercise Name', 'Any text', 'Must match an exercise in your library'],
                      ['Default Sets', 'Positive integer', 'e.g. 3'],
                      ['Default Reps', 'Positive integer', 'e.g. 10'],
                      ['Default Weight (kg)', 'Number', 'Use 0 for bodyweight exercises'],
                    ].map(([col, allowed, notes]) => (
                      <tr key={col} className="hover:bg-surface">
                        <td className="px-3 py-2 font-mono text-accent-content whitespace-nowrap">{col}</td>
                        <td className="px-3 py-2 text-content-muted">{allowed}</td>
                        <td className="px-3 py-2 text-content-subtle">{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-content">Sample File</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(sampleCSV)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-content-muted hover:bg-surface-sunken transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => triggerDownload(sampleCSV, 'sample-template.csv', 'text/csv')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-content-muted hover:bg-surface-sunken transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
                <pre className="bg-surface-overlay text-positive rounded-xl p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre">
                  {sampleCSV}
                </pre>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-5">
              <p className="text-sm text-content-muted">
                Copy this prompt and paste it into any AI chat (ChatGPT, Claude, Gemini, etc.) to generate a template file you can import directly.
              </p>

              <div className="bg-accent-soft border border-accent rounded-xl p-4">
                <p className="text-xs font-medium text-accent-content mb-1">How to use</p>
                <ol className="text-xs text-accent-content space-y-1 list-decimal list-inside">
                  <li>Copy the prompt below</li>
                  <li>Open your preferred AI assistant</li>
                  <li>Paste the prompt and describe the template you want</li>
                  <li>Save the AI's response as a <code className="bg-accent-soft px-1 rounded">.json</code> file</li>
                  <li>Import it here using the Import button</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-content">AI Prompt</h3>
                  <button
                    onClick={() => handleCopy(AI_PROMPT)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-content-muted hover:bg-surface-sunken transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>
                <div className="bg-surface border border-edge rounded-xl p-4 text-xs text-content-muted leading-relaxed whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                  {AI_PROMPT}
                </div>
              </div>

              <div className="bg-caution-soft border border-caution rounded-xl p-4">
                <p className="text-xs font-medium text-caution-content mb-1">Tip about exercise names</p>
                <p className="text-xs text-caution leading-relaxed">
                  Exercise names must match exercises that exist in your library. If the AI uses a different name, the import will ask you to choose a substitute from your library.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-edge flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerDownload(sampleJSON, 'sample-template.json', 'application/json')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-xs font-medium text-content-muted hover:bg-surface transition-colors"
            >
              <FileJson className="h-3.5 w-3.5 text-accent" />
              Sample JSON
            </button>
            <button
              onClick={() => triggerDownload(sampleCSV, 'sample-template.csv', 'text/csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-edge text-xs font-medium text-content-muted hover:bg-surface transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-positive" />
              Sample CSV
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-overlay text-content-inverse text-sm font-medium hover:bg-surface-overlay transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateFormatGuide;
