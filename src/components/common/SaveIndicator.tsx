import React from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export const SaveIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { saveStatus } = useSettings();

  if (saveStatus === 'idle') return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all duration-300 animate-fade-in ${
        saveStatus === 'saved'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
      } ${className}`}
    >
      {saveStatus === 'saved' ? (
        <>
          <Check className="w-3 h-3 text-emerald-500" />
          <span>Guardado</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
          <span>Guardando...</span>
        </>
      )}
    </div>
  );
};
