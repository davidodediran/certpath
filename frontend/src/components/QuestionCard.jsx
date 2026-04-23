import React from 'react';
import { Flag, CheckCircle, XCircle, CheckSquare } from 'lucide-react';

export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedAnswer,   // string: "B" for single, "BD" for multi-select
  onAnswer,
  flagged,
  onToggleFlag,
  showResult = false,   // practice/review mode: show correct/wrong immediately
  correctAnswer = null,
  explanation = null,
  referenceUrl = null,
  readOnly = false,
}) {
  const opts = question.options || [];

  // ── Multi-select detection ─────────────────────────────────
  // Three-layer detection so it works even when DB metadata is missing:
  //  1. question_type === 'multi'  (set by backend after migration)
  //  2. max_selections > 1         (set by backend after migration)
  //  3. question text contains "(Choose N.)" — immediate fallback that
  //     works for any question whose text follows the AWS convention,
  //     regardless of whether the DB migration has run yet.
  const WORD_TO_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  // Matches: (Choose two.) / (Select three.) / (Choose 2.) — case-insensitive, period optional
  const chooseMatch = question.question?.match(/\((?:Choose|Select)\s+(\w+)\.?\)/i);
  const textMaxSel  = chooseMatch ? (WORD_TO_NUM[chooseMatch[1].toLowerCase()] || parseInt(chooseMatch[1], 10) || 0) : 0;

  const maxSel  = (question.max_selections > 1 ? question.max_selections : null)
               || (textMaxSel > 1 ? textMaxSel : null)
               || 1;
  const isMulti = question.question_type === 'multi' || maxSel > 1;

  const isClickable = !readOnly && !showResult;

  // ── Multi-select toggle handler ────────────────────────────
  const handleClick = (label) => {
    if (!isClickable) return;
    if (!isMulti) {
      onAnswer(question.id, label);
      return;
    }
    // Toggle label in/out of sorted multi-select answer string
    const current = (selectedAnswer || '').toUpperCase().split('').filter(Boolean);
    const isAlreadySelected = current.includes(label.toUpperCase());

    if (isAlreadySelected) {
      // Deselect — always allowed
      const next = current.filter((l) => l !== label.toUpperCase()).sort();
      onAnswer(question.id, next.join(''));
    } else if (current.length < maxSel) {
      // Under the limit — add it
      const next = [...current, label.toUpperCase()].sort();
      onAnswer(question.id, next.join(''));
    }
    // else: at limit and this option isn't selected — do nothing (block)
  };

  // Whether the student has filled all selections for a multi-select question
  const selectedCount = isMulti ? (selectedAnswer || '').replace(/[^A-Za-z]/g, '').length : 0;
  const atLimit = isMulti && isClickable && selectedCount >= maxSel;

  // ── Option state ───────────────────────────────────────────
  const getOptionState = (label) => {
    const isSelected = isMulti
      ? !!(selectedAnswer?.toUpperCase().includes(label.toUpperCase()))
      : selectedAnswer === label;

    if (!showResult) {
      if (isSelected) return 'selected';
      // Unselected option when at limit — visually locked
      if (atLimit) return 'disabled';
      return 'default';
    }
    // Practice / review mode — show correct/wrong
    const isCorrect = correctAnswer
      ? correctAnswer.toUpperCase().includes(label.toUpperCase())
      : false;
    if (isCorrect) return 'correct';
    if (isSelected && !isCorrect) return 'wrong';
    return 'neutral';
  };

  // ── Style maps ─────────────────────────────────────────────
  const OPTION_CLASSES = {
    default:  'border-gray-200 dark:border-gray-700 hover:border-aws-orange/60 hover:bg-orange-50/60 dark:hover:bg-gray-700/50 cursor-pointer text-gray-800 dark:text-gray-200',
    selected: 'border-aws-orange bg-aws-orange/10 dark:bg-aws-orange/20 text-gray-900 dark:text-white font-medium',
    disabled: 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 opacity-50 cursor-not-allowed',
    correct:  'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-medium',
    wrong:    'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300',
    neutral:  'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500 opacity-60',
  };

  const INDICATOR_CLASSES = {
    default:  'border-gray-300 dark:border-gray-600',
    selected: 'border-aws-orange bg-aws-orange',
    disabled: 'border-gray-200 dark:border-gray-700',
    correct:  'border-green-500 bg-green-500',
    wrong:    'border-red-400 bg-red-400',
    neutral:  'border-gray-300 dark:border-gray-600',
  };

  return (
    <div className="card p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Question {questionIndex + 1} <span className="text-gray-300 dark:text-gray-600">/ {totalQuestions}</span>
        </span>
        {!readOnly && (
          <button
            onClick={() => onToggleFlag(question.id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
              flagged
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-amber-400 hover:text-amber-500'
            }`}
          >
            <Flag size={12} />
            {flagged ? 'Flagged' : 'Flag for review'}
          </button>
        )}
      </div>

      {/* Question text */}
      <p className="text-gray-900 dark:text-gray-100 font-medium text-sm sm:text-base md:text-lg leading-relaxed mb-4">
        {question.question}
      </p>

      {/* Multi-select hint */}
      {isMulti && (
        <p className={`text-xs font-semibold flex items-center gap-1.5 mb-5 ${atLimit ? 'text-green-600 dark:text-green-400' : 'text-aws-orange'}`}>
          <CheckSquare size={13} />
          {atLimit
            ? `✓ ${maxSel} of ${maxSel} selected — deselect one to change`
            : `Select ${maxSel} answer${maxSel !== 1 ? 's' : ''}`
          }
          {isClickable && !atLimit && selectedCount > 0 && (
            <span className="ml-1 text-gray-400 font-normal">
              ({selectedCount}/{maxSel} selected)
            </span>
          )}
        </p>
      )}

      {/* Options */}
      <div className="space-y-3">
        {opts.map((opt) => {
          const state = getOptionState(opt.label);
          return (
            <div
              key={opt.label}
              onClick={() => handleClick(opt.label)}
              role={isClickable ? (isMulti ? 'checkbox' : 'radio') : undefined}
              aria-checked={
                isMulti
                  ? !!(selectedAnswer?.toUpperCase().includes(opt.label.toUpperCase()))
                  : selectedAnswer === opt.label
              }
              className={`flex items-center gap-3 sm:gap-4 px-3 py-3 sm:px-4 sm:py-4 rounded-xl border-2 transition-all select-none ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              } ${OPTION_CLASSES[state]}`}
            >
              {/* Indicator — square for multi-select, round for single */}
              <span
                className={`flex-shrink-0 w-5 h-5 ${isMulti ? 'rounded' : 'rounded-full'} border-2 flex items-center justify-center transition-all ${INDICATOR_CLASSES[state]}`}
              >
                {isMulti ? (
                  (state === 'selected' || state === 'correct' || state === 'wrong') && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )
                ) : (
                  (state === 'selected' || state === 'correct' || state === 'wrong') && (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )
                )}
              </span>

              {/* Option text */}
              <span className="text-sm leading-relaxed flex-1">{opt.text}</span>

              {/* Result icon (practice / review mode) */}
              {state === 'correct' && <CheckCircle size={16} className="text-green-500 shrink-0" />}
              {state === 'wrong' && <XCircle size={16} className="text-red-400 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Explanation (practice mode / review) */}
      {showResult && explanation && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">Explanation</p>
          <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{explanation}</p>
          {referenceUrl && (
            <a
              href={referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 underline break-all"
            >
              AWS Reference Documentation →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
