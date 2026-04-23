import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import api from '../lib/api';
import { generateResultPDF } from '../lib/pdf';
import { Download, Eye, RotateCcw, CheckCircle, XCircle, ChevronLeft, BookOpen, TrendingUp, Lightbulb, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';

export default function Results() {
  const { sessionId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(!result);
  const [reviewData, setReviewData] = useState(null);
  const [showExplanations, setShowExplanations] = useState(true);
  const [expandedExplanation, setExpandedExplanation] = useState({});

  useEffect(() => {
    if (!result) {
      api.get(`/results/${sessionId}`)
        .then((r) => setResult({ ...r.data, domainResults: r.data.domain_results }))
        .finally(() => setLoading(false));
    }
  }, [sessionId]);

  // Fetch per-question review data so we can show explanations inline on the results page
  useEffect(() => {
    if (!result) return;
    api.get(`/exams/${sessionId}/review`)
      .then((r) => setReviewData(r.data))
      .catch(() => {}); // best-effort — review section is optional
  }, [result, sessionId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Loading results...</div>
    </div>
  );

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Result not found.</div>
    </div>
  );

  const dr = result.domainResults || result.domain_results || {};
  const passed = result.passed;

  // Build an ordered list of domains from the actual exam data.
  // Sorted by sortOrder (from exam_domains config) so they always appear
  // in the canonical sequence regardless of which domain was answered first.
  const domainList = Object.entries(dr)
    .sort(([, a], [, b]) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map(([name, stats]) => ({ name, ...stats }));
  const score = result.score || 0;
  const examDate = result.submitted_at
    ? new Date(result.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const handleDownload = () => {
    generateResultPDF({
      examName: result.examName,
      studentEmail: user.name || user.email || result.studentEmail,
      examDate,
      sessionId,
      score,
      passed,
      domainResults: dr,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => nav('/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-aws-orange mb-6 transition">
          <ChevronLeft size={16} /> Dashboard
        </button>

        {/* AWS-style result card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header bar */}
          <div className="bg-aws-navy px-4 sm:px-6 py-4">
            <p className="text-gray-300 text-xs uppercase tracking-widest mb-0.5">AWS Certification</p>
            <h1 className="text-white font-bold text-lg">{result.examName || 'AWS Certified Cloud Practitioner'}</h1>
          </div>
          <div className="h-1 bg-aws-orange" />

          <div className="p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
              Notice of Exam Results
            </h2>

            {/* Candidate info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-5 sm:mb-6">
              <div>
                <span className="text-gray-400 dark:text-gray-500">Candidate:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">{user.name || user.email || result.studentEmail || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500">Exam Date:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-white">{examDate}</span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500">Mode:</span>{' '}
                <span className="font-medium capitalize text-gray-900 dark:text-white">{result.mode}</span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500">Session ID:</span>{' '}
                <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{sessionId?.slice(0, 8)}</span>
              </div>
            </div>

            {/* Score + Pass/Fail */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3 mb-5 sm:mb-6">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Candidate Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-aws-orange">{score}</span>
                  <span className="text-gray-400 mb-1">/ 1000</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Passing: {result.passingScore || 700}</p>
              </div>
              <div className={`flex-1 rounded-xl p-4 border flex flex-col items-center justify-center ${passed ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}>
                {passed ? (
                  <>
                    <CheckCircle size={36} className="text-green-500 mb-2" />
                    <span className="text-2xl font-bold text-green-700 dark:text-green-400">PASS</span>
                  </>
                ) : (
                  <>
                    <XCircle size={36} className="text-red-500 mb-2" />
                    <span className="text-2xl font-bold text-red-700 dark:text-red-400">FAIL</span>
                  </>
                )}
              </div>
            </div>

            {passed && (
              <div className="mb-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-300">
                Congratulations! You have successfully passed this certification exam.
              </div>
            )}

            {/* Unscored questions notice — mirrors real AWS exam format */}
            {(() => {
              const unscoredIds = result.unscored_question_ids || [];
              const unscoredCount = Array.isArray(unscoredIds) ? unscoredIds.length : 0;
              const scoredCount = result.total || ((result.totalQuestions || result.questionsPerExam || 65) - unscoredCount);
              if (unscoredCount === 0) return null;
              return (
                <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg text-sm">
                  <FlaskConical size={15} className="text-purple-500 mt-0.5 flex-shrink-0" />
                  <p className="text-purple-800 dark:text-purple-300">
                    This exam included <strong>{unscoredCount} unscored research question{unscoredCount !== 1 ? 's' : ''}</strong> that did not affect your score.
                    Your result is based on <strong>{scoredCount} scored questions</strong>.
                  </p>
                </div>
              );
            })()}

            {/* Domain breakdown */}
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 text-sm">Breakdown of Exam Results</h3>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Section level results are intended to highlight areas of strength and weakness. The exam uses a compensatory scoring model — you do not need to pass each section individually.
            </p>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-aws-navy text-white">
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Section</th>
                  <th className="text-center px-4 py-2.5 font-medium text-xs">% of Items</th>
                  <th className="text-center px-4 py-2.5 font-medium text-xs">Performance</th>
                </tr>
              </thead>
              <tbody>
                {domainList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-gray-400 text-sm">No domain breakdown available.</td>
                  </tr>
                ) : domainList.map(({ name, weight, percentage, performance }, i) => {
                  const perf = performance || '—';
                  const weightStr = weight != null ? `${weight}%` : '—';
                  return (
                    <tr key={name} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                      <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200">Domain {i + 1}: {name}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">{weightStr}</td>
                      <td className={`px-4 py-2.5 text-center font-medium ${perf === 'Meets Competency' ? 'text-green-600 dark:text-green-400' : perf === 'Needs Improvement' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                        {perf}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Legend */}
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p><span className="font-semibold text-green-600">Meets Competency:</span> Performance demonstrates knowledge, skills, and abilities expected of a passing candidate.</p>
              <p><span className="font-semibold text-red-600">Needs Improvement:</span> Performance does not demonstrate knowledge, skills, and abilities expected of a passing candidate.</p>
              <p><span className="font-semibold text-gray-400">Not Assessed:</span> No questions from this domain appeared in this exam draw.</p>
            </div>
          </div>

          {/* ── What to Study Next ── */}
          {(() => {
            const weakDomains   = domainList.filter((d) => d.performance === 'Needs Improvement').map((d) => d.name);
            const strongDomains = domainList.filter((d) => d.performance === 'Meets Competency').map((d) => d.name);

            if (weakDomains.length === 0 && !passed) return null;

            return (
              <div className="mx-4 sm:mx-6 mb-5 sm:mb-6 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={16} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm">
                    {passed ? 'Keep Your Edge' : 'What to Focus On Next'}
                  </h3>
                </div>

                {passed && weakDomains.length === 0 ? (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Excellent result — you met competency in all domains. Consider attempting a harder certification or reviewing edge-case topics to stay sharp.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {weakDomains.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1.5">
                          Needs Improvement
                        </p>
                        <div className="space-y-1.5">
                          {weakDomains.map((d) => (
                            <div key={d} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <TrendingUp size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium">{d}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                  — review practice questions focused on this domain
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {strongDomains.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">
                          Strengths to maintain
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {strongDomains.join(', ')}
                        </p>
                      </div>
                    )}
                    <div className="pt-1">
                      <button
                        onClick={() => nav('/dashboard')}
                        className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        <BookOpen size={14} /> Start a practice session targeting weak areas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Wrong Answers & Explanations ── */}
          {reviewData && reviewData.filter((q) => !q.isCorrect && !q.isUnscored).length > 0 && (
            <div className="mx-4 sm:mx-6 mb-5 sm:mb-6">
              <button
                onClick={() => setShowExplanations((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/25 transition"
              >
                <span className="flex items-center gap-2">
                  <XCircle size={16} className="text-red-500" />
                  {reviewData.filter((q) => !q.isCorrect && !q.isUnscored).length} Wrong Answer{reviewData.filter((q) => !q.isCorrect && !q.isUnscored).length !== 1 ? 's' : ''} — See Explanations
                </span>
                {showExplanations ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showExplanations && (
                <div className="mt-3 space-y-3">
                  {reviewData.filter((q) => !q.isCorrect && !q.isUnscored).map((q, i) => {
                    const isOpen = !!expandedExplanation[q.id];
                    const opts   = q.options || [];
                    return (
                      <div key={q.id} className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                        <button
                          onClick={() => setExpandedExplanation((e) => ({ ...e, [q.id]: !e[q.id] }))}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug line-clamp-2">{q.question}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                              {q.studentAnswer
                                ? <span className="text-red-500 font-medium">Your answer: {q.studentAnswer}</span>
                                : <span className="text-gray-400">Skipped</span>}
                              <span className="text-green-600 font-medium">Correct: {q.correctAnswer}</span>
                            </div>
                          </div>
                          <span className="text-gray-400 text-xs flex-shrink-0 mt-1">{isOpen ? '▲' : '▼'}</span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-red-100 dark:border-red-900/30 px-4 pb-4 pt-3 space-y-3">
                            {/* Options */}
                            <div className="space-y-1.5">
                              {opts.map((opt) => {
                                const isCorrectOpt  = q.correctAnswer && q.correctAnswer.toUpperCase().includes(opt.label);
                                const isSelectedOpt = q.studentAnswer && q.studentAnswer.toUpperCase().includes(opt.label);
                                return (
                                  <div key={opt.label} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${
                                    isCorrectOpt
                                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                      : isSelectedOpt
                                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                                      : 'border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}>
                                    <span className="font-bold w-5 flex-shrink-0 text-xs mt-0.5">{opt.label}.</span>
                                    <span>{opt.text}</span>
                                    {isCorrectOpt && <CheckCircle size={13} className="text-green-500 ml-auto flex-shrink-0 mt-0.5" />}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Explanation */}
                            {q.explanation && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">Explanation</p>
                                <p className="text-sm text-blue-900 dark:text-blue-200">{q.explanation}</p>
                                {q.referenceUrl && (
                                  <a href={q.referenceUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-block mt-2 text-xs text-blue-600 underline break-all">
                                    AWS Documentation ↗
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
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-4 sm:px-6 pb-5 sm:pb-6 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
            <button onClick={handleDownload} className="btn-primary flex items-center justify-center gap-2 text-sm col-span-2 sm:col-auto">
              <Download size={15} /> <span>Download PDF</span>
            </button>
            <button onClick={() => nav(`/results/${sessionId}/review`)} className="btn-secondary flex items-center justify-center gap-2 text-sm">
              <Eye size={15} /> <span className="hidden sm:inline">Review All Answers</span><span className="sm:hidden">Review</span>
            </button>
            {result.mode === 'exam' && (
              <button onClick={() => nav(`/results/${sessionId}/survey`)} className="btn-secondary flex items-center justify-center gap-2 text-sm">
                ★ <span className="hidden sm:inline">Give Feedback</span><span className="sm:hidden">Feedback</span>
              </button>
            )}
            <button onClick={() => nav('/dashboard')} className="btn-secondary flex items-center justify-center gap-2 text-sm">
              <RotateCcw size={15} /> <span>New Exam</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
