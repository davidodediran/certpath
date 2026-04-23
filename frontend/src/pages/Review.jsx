import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { ChevronLeft, CheckCircle, XCircle, Minus, FlaskConical } from 'lucide-react';

const FILTERS = ['All', 'Correct', 'Incorrect', 'Unscored'];

export default function Review() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api.get(`/exams/${sessionId}/review`)
      .then((r) => setQuestions(r.data))
      .catch(() => nav('/dashboard'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const scored = questions.filter((q) => !q.isUnscored);
  const filtered = questions.filter((q) => {
    if (filter === 'Correct')   return q.isCorrect && !q.isUnscored;
    if (filter === 'Incorrect') return !q.isCorrect && q.studentAnswer && !q.isUnscored;
    if (filter === 'Unscored')  return q.isUnscored;
    return true; // All
  });

  const correct   = scored.filter((q) => q.isCorrect).length;
  const incorrect = scored.filter((q) => !q.isCorrect && q.studentAnswer).length;
  const skipped   = scored.filter((q) => !q.studentAnswer).length;
  const unscoredCount = questions.filter((q) => q.isUnscored).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Loading review...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => nav(`/results/${sessionId}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-aws-orange mb-6 transition">
          <ChevronLeft size={16} /> Back to Results
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Answer Review</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> {correct} Correct</span>
            <span className="flex items-center gap-1 text-red-600"><XCircle size={14} /> {incorrect} Incorrect</span>
            <span className="flex items-center gap-1 text-gray-400"><Minus size={14} /> {skipped} Skipped</span>
            {unscoredCount > 0 && (
              <span className="flex items-center gap-1 text-purple-500"><FlaskConical size={14} /> {unscoredCount} Unscored</span>
            )}
          </div>
          {unscoredCount > 0 && (
            <p className="mt-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 leading-relaxed">
              <span className="font-semibold text-purple-500">ℹ {unscoredCount} unscored question{unscoredCount !== 1 ? 's' : ''}</span> — these were included for research purposes and did <strong>not</strong> affect your score. Your score was calculated from {scored.length} scored questions.
            </p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {FILTERS.filter((f) => f !== 'Unscored' || unscoredCount > 0).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                filter === f
                  ? 'bg-aws-orange text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {f === 'All'       ? `All (${questions.length})`    :
               f === 'Correct'   ? `Correct (${correct})`         :
               f === 'Incorrect' ? `Incorrect (${incorrect})`     :
               f === 'Unscored'  ? `Unscored (${unscoredCount})`  : f}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map((q, i) => {
            const isOpen = !!expanded[q.id];
            const opts = q.options || [];
            return (
              <div key={q.id} className="card overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                  onClick={() => setExpanded((e) => ({ ...e, [q.id]: !e[q.id] }))}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {q.isUnscored ? (
                      <FlaskConical size={20} className="text-purple-400" />
                    ) : q.isCorrect ? (
                      <CheckCircle size={20} className="text-green-500" />
                    ) : q.studentAnswer ? (
                      <XCircle size={20} className="text-red-500" />
                    ) : (
                      <Minus size={20} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">Q{i + 1}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{q.domain}</span>
                      {q.isUnscored && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                          <FlaskConical size={10} /> Unscored
                        </span>
                      )}
                      {q.studentAnswer && (
                        <span className={`text-xs font-medium ${q.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          Your answer: {q.studentAnswer}
                        </span>
                      )}
                      {!q.studentAnswer && <span className="text-xs text-gray-400">Skipped</span>}
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug line-clamp-2">{q.question}</p>
                  </div>
                  <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4">
                    {q.isUnscored && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <FlaskConical size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          <strong>Unscored question</strong> — this question was included for research purposes and did not count toward your final score. You can still review it to learn.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2 mb-4">
                      {opts.map((opt) => {
                        const isCorrectOpt = q.correctAnswer && q.correctAnswer.includes(opt.label);
                        const isSelectedOpt = q.studentAnswer === opt.label;
                        return (
                          <div
                            key={opt.label}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                              isCorrectOpt
                                ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                                : isSelectedOpt
                                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                                : 'border-gray-100 dark:border-gray-700'
                            }`}
                          >
                            <span className="text-xs font-bold w-5 text-center flex-shrink-0 mt-0.5">
                              {opt.label}
                            </span>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{opt.text}</span>
                            {isCorrectOpt && <CheckCircle size={14} className="text-green-500 ml-auto flex-shrink-0 mt-0.5" />}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">Explanation</p>
                        <p className="text-sm text-blue-900 dark:text-blue-200">{q.explanation}</p>
                        {q.referenceUrl && (
                          <a href={q.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs text-blue-600 underline break-all">
                            AWS Documentation
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card p-8 text-center text-gray-400">No questions match this filter.</div>
        )}
      </div>
    </div>
  );
}
