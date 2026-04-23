import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function ExamTimer({ limitMinutes, onExpire, value }) {
  const totalSeconds = limitMinutes * 60;
  // Controlled mode: parent owns the timer state (value prop provided)
  // Uncontrolled mode: internal timer (legacy / practice fallback)
  const isControlled = value !== undefined && value !== null;
  const [internalSeconds, setInternalSeconds] = useState(totalSeconds);
  const secondsLeft = isControlled ? value : internalSeconds;
  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (isControlled) return; // parent drives the timer — nothing to do here
    if (internalSeconds <= 0) { onExpire?.(); return; }
    const id = setInterval(() => setInternalSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [isControlled, internalSeconds, onExpire]);

  const mm = String(Math.floor(Math.max(0, secondsLeft) / 60)).padStart(2, '0');
  const ss = String(Math.max(0, secondsLeft) % 60).padStart(2, '0');
  const pct = Math.max(0, (secondsLeft / totalSeconds) * 100);

  const isDanger  = secondsLeft <= 5 * 60;   // red: ≤ 5 min
  const isWarning = secondsLeft <= 15 * 60;  // amber: ≤ 15 min

  const barColor = isDanger
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-400'
    : 'bg-green-400';

  const containerClass = isDanger
    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
    : isWarning
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800'
    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  const textClass = isDanger
    ? 'text-red-700 dark:text-red-400'
    : isWarning
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <div className={`flex flex-col gap-1 px-3 py-1.5 rounded-lg border ${containerClass} min-w-[90px]`}>
      <div className={`flex items-center gap-1.5 ${textClass}`}>
        <Clock size={14} className={isDanger ? 'animate-pulse' : ''} />
        <span className="font-mono font-bold text-sm tabular-nums">{mm}:{ss}</span>
        {isDanger && (
          <span className="text-xs font-semibold animate-pulse">Low!</span>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
