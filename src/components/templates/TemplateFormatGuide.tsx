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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Format Guide</h2>
            <p className="text-xs text-gray-500 mt-0.5">Reference for creating or editing template files</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
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
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {tab === 'json' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                JSON is the recommended format for creating templates with AI. It supports all fields and is easy to validate.
              </p>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Schema</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs font-mono leading-relaxed text-gray-700 overflow-x-auto">
                  <p><span className="text-blue-600">"schema_version"</span>: <span className="text-green-600">"1.0"</span> <span className="text-gray-400">(required, always "1.0")</span></p>
                  <p><span className="text-blue-600">"exported_at"</span>: <span className="text-green-600">"2024-01-01T00:00:00.000Z"</span> <span className="text-gray-400">(ISO 8601)</span></p>
                  <p><span className="text-blue-600">"templates"</span>: <span className="text-gray-400">array of template objects</span></p>
                </div>

                <h3 className="text-sm font-semibold text-gray-800 pt-1">Template object fields</h3>
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Field</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Allowed values</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ['name', 'string', 'Any text', 'Yes'],
                      ['description', 'string | null', 'Any text or null', 'No'],
                      ['template_type', 'string', '"regular" or "superset"', 'Yes'],
                      ['category', 'string', '"Upper Body", "Lower Body", "Core Focused", "Whole Body"', 'Yes'],
                      ['exercises', 'array', 'Array of exercise objects', 'Yes'],
                    ].map(([field, type, allowed, req]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-blue-700">{field}</td>
                        <td className="px-3 py-2 text-gray-500">{type}</td>
                        <td className="px-3 py-2 text-gray-600">{allowed}</td>
                        <td className="px-3 py-2">{req === 'Yes' ? <span className="text-red-500 font-medium">Yes</span> : <span className="text-gray-400">No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="text-sm font-semibold text-gray-800 pt-1">Exercise object fields</h3>
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Field</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ['order_index', 'number', 'Starts at 0, increments by 1'],
                      ['exercise_name', 'string', 'Must match an exercise in your library'],
                      ['default_sets', 'number', 'Positive integer'],
                      ['default_reps', 'number', 'Positive integer'],
                      ['default_weight', 'number', 'In kilograms (kg)'],
                    ].map(([field, type, notes]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-blue-700">{field}</td>
                        <td className="px-3 py-2 text-gray-500">{type}</td>
                        <td className="px-3 py-2 text-gray-600">{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Sample File</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(sampleJSON)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => triggerDownload(sampleJSON, 'sample-template.json', 'application/json')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
                <pre className="bg-gray-900 text-green-400 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre">
                  {sampleJSON}
                </pre>
              </div>
            </div>
          )}

          {tab === 'csv' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                CSV works well for editing templates in a spreadsheet application. Each row represents one exercise within a template.
              </p>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Column Reference</h3>
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Column</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Allowed values</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
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
                      <tr key={col} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-blue-700 whitespace-nowrap">{col}</td>
                        <td className="px-3 py-2 text-gray-600">{allowed}</td>
                        <td className="px-3 py-2 text-gray-500">{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Sample File</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(sampleCSV)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => triggerDownload(sampleCSV, 'sample-template.csv', 'text/csv')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
                <pre className="bg-gray-900 text-green-400 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre">
                  {sampleCSV}
                </pre>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Copy this prompt and paste it into any AI chat (ChatGPT, Claude, Gemini, etc.) to generate a template file you can import directly.
              </p>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-medium text-blue-800 mb-1">How to use</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Copy the prompt below</li>
                  <li>Open your preferred AI assistant</li>
                  <li>Paste the prompt and describe the template you want</li>
                  <li>Save the AI's response as a <code className="bg-blue-100 px-1 rounded">.json</code> file</li>
                  <li>Import it here using the Import button</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">AI Prompt</h3>
                  <button
                    onClick={() => handleCopy(AI_PROMPT)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                  {AI_PROMPT}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-medium text-amber-800 mb-1">Tip about exercise names</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Exercise names must match exercises that exist in your library. If the AI uses a different name, the import will ask you to choose a substitute from your library.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerDownload(sampleJSON, 'sample-template.json', 'application/json')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FileJson className="h-3.5 w-3.5 text-blue-500" />
              Sample JSON
            </button>
            <button
              onClick={() => triggerDownload(sampleCSV, 'sample-template.csv', 'text/csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-green-500" />
              Sample CSV
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateFormatGuide;
