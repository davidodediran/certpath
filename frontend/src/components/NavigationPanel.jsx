import React from 'react';

export default function NavigationPanel({ questions, answers, flagged, currentIndex, onGoTo, cols = 5, maxH = 'max-h-[420px]' }) {
  const gridCols = { 5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8' }[cols] || 'grid-cols-5';
  return (
    <div className="card p-4 flex flex-col">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Question Navigator
        <span className="ml-1 font-normal text-gray-400">({questions.length})</span>
      </h3>
      <div className={`overflow-y-auto ${maxH} pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600`}>
      <div className={`grid ${gridCols} gap-1.5`}>
        {questions.map((q, i) => {
          const answered = !!answers[q.id];
          const isFlagged = flagged.has(q.id);
          const isCurrent = i === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => onGoTo(i)}
              className={`w-full aspect-square text-xs font-semibold rounded-md transition-all ${
                isCurrent
                  ? 'ring-2 ring-aws-orange bg-aws-orange text-white'
                  : isFlagged
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-400'
                  : answered
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
              }`}
              title={`Question ${i + 1}${isFlagged ? ' (Flagged)' : answered ? ' (Answered)' : ' (Unanswered)'}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      </div>
      {/* Legend */}
      <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-aws-orange inline-block"></span> Current</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900 border border-green-400 inline-block"></span> Answered</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-900 border border-amber-400 inline-block"></span> Flagged</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 inline-block"></span> Unanswered</div>
      </div>
    </div>
  );
}
