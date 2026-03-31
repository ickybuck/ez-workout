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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Export Templates</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <p className="text-xs text-gray-500">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'} &bull;{' '}
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Choose format</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('json')}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 transition-all text-left ${
                  format === 'json'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <FileJson className={`h-5 w-5 ${format === 'json' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${format === 'json' ? 'text-blue-700' : 'text-gray-700'}`}>
                  JSON
                </span>
                <span className="text-xs text-gray-500 leading-snug">
                  Structured, AI-friendly, full fidelity
                </span>
              </button>

              <button
                onClick={() => setFormat('csv')}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 transition-all text-left ${
                  format === 'csv'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <FileText className={`h-5 w-5 ${format === 'csv' ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${format === 'csv' ? 'text-green-700' : 'text-gray-700'}`}>
                  CSV
                </span>
                <span className="text-xs text-gray-500 leading-snug">
                  Spreadsheet-compatible, easy to edit
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
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
