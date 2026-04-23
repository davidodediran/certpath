import React from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';

export function StrikeWarning({ strikes, message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md mx-4 border-2 border-amber-400">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={28} className="text-amber-500 flex-shrink-0" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Integrity Violation — Warning {strikes} of 3
          </h2>
        </div>
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-2">{message}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          Leaving the exam window, switching tabs, or exiting full-screen constitutes a violation.
          A third violation will immediately cancel your exam.
        </p>
        <button onClick={onDismiss} className="w-full btn-primary">
          I understand — Resume Exam
        </button>
      </div>
    </div>
  );
}

export function CancelledScreen({ message, onGoHome }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/20 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md mx-4 border-2 border-red-500">
        <div className="flex items-center gap-3 mb-4">
          <XCircle size={32} className="text-red-500 flex-shrink-0" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Exam Cancelled</h2>
        </div>
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-2">{message}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          No score has been recorded for this session. Your device has been flagged and Exam Mode access
          is suspended for 24 hours from this violation.
        </p>
        <button onClick={onGoHome} className="w-full btn-danger">
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
