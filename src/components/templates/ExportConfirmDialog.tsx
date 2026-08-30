import React, { useState } from 'react';
import { X, FileJson, FileText, Download } from 'lucide-react';
import { WorkoutTemplate } from '../../types/template';
import { exportTemplatesAsJSON, exportTemplatesAsCSV } from '../../lib/templateExport';

type ExportFormat = 'json' | 'csv';

interface ExportConfirmDialogProps {
  templates: WorkoutTemplate[];
  label: string;
  onClose: () => void;
}

const ExportConfirmDialog: React.FC<ExportConfirmDialogProps> = ({
  templates,
  label,
  onClose,
}) => {
  const [format, setFormat] = useState<ExportFormat>('json');

  const exerciseCount = templates.reduce((sum, t) => sum + t.exercises.length, 0);

  const handleDownload = () => {
    if (format === 'json') {
      exportTemplatesAsJSON(templates);
    } else {
      exportTemplatesAsCSV(templates);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-edge">
          <h2 className="text-lg font-semibold text-content">Export Templates</h2>
          <button
            onClick={onClose}
            className="p-2.5 text-content-subtle hover:text-content-muted hover:bg-surface-sunken rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="bg-surface rounded-xl p-4 space-y-1">
            <p className="text-sm font-medium text-content">{label}</p>
            <p className="text-xs text-content-subtle">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'} &bull;{' '}
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-content-muted mb-3">Choose format</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('json')}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 transition-all text-left ${
                  format === 'json'
                    ? 'border-accent bg-accent-soft'
                    : 'border-edge hover:border-edge-strong bg-surface-raised'
                }`}
              >
                <FileJson className={`h-5 w-5 ${format === 'json' ? 'text-accent' : 'text-content-subtle'}`} />
                <span className={`text-sm font-semibold ${format === 'json' ? 'text-accent-content' : 'text-content-muted'}`}>
                  JSON
                </span>
                <span className="text-xs text-content-subtle leading-snug">
                  Structured, AI-friendly, full fidelity
                </span>
              </button>

              <button
                onClick={() => setFormat('csv')}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 transition-all text-left ${
                  format === 'csv'
                    ? 'border-positive bg-positive-soft'
                    : 'border-edge hover:border-edge-strong bg-surface-raised'
                }`}
              >
                <FileText className={`h-5 w-5 ${format === 'csv' ? 'text-positive' : 'text-content-subtle'}`} />
                <span className={`text-sm font-semibold ${format === 'csv' ? 'text-positive-content' : 'text-content-muted'}`}>
                  CSV
                </span>
                <span className="text-xs text-content-subtle leading-snug">
                  Spreadsheet-compatible, easy to edit
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-edge text-sm font-medium text-content-muted hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-overlay text-content-inverse text-sm font-medium hover:bg-surface-overlay transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportConfirmDialog;
