import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useExamStore } from '../store/examStore';
import api from '../lib/api';
import * as antiCheat from '../lib/antiCheat';
import { requestFullscreen, exitFullscreen, reinforce, getActivityLog } from '../lib/antiCheat';
import QuestionCard from '../components/QuestionCard';
import ExamTimer from '../components/ExamTimer';
import { StrikeWarning, CancelledScreen } from '../components/AntiCheatWarning';
import { ChevronLeft, ChevronRight, Send, Flag, CheckCircle, Eye, AlertTriangle, Activity } from 'lucide-react';

// ── Review Page ───────────────────────────────────────────────
function ReviewPage({ questions, answers, flagged, onGoTo, onSubmit, submitting }) {
  const unanswered = questions.filter((q) => !answers[q.id]);
  const answeredCount = Object.keys(answers).length;
  const flaggedUnanswered = questions.filter((q) => flagged.has(q.id) && !answers[q.id]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Review Header */}
      <div className="bg-aws-navy shadow-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-aws-orange rounded flex-shrink-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-semibold text-sm">Review Your Answers</span>
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
          >
            <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Final Exam'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Summary banner */}
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{answeredCount}</p>
              <p className="text-xs text-gray-500">Answered</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${unanswered.length > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {unanswered.length}
              </p>
              <p className="text-xs text-gray-500">Unanswered</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{flagged.size}</p>
              <p className="text-xs text-gray-500">Flagged</p>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {unanswered.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>{unanswered.length} question{unanswered.length !== 1 ? 's' : ''} unanswered.</strong> Unanswered questions are marked wrong. Go back and attempt them before submitting.
            </p>
          </div>
        )}
        {flaggedUnanswered.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <Flag size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>{flaggedUnanswered.length} flagged question{flaggedUnanswered.length !== 1 ? 's' : ''} still unanswered.</strong> You flagged these for review — click them below to answer.
            </p>
          </div>
        )}
        {flagged.size > 0 && flaggedUnanswered.length === 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <Flag size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You have {flagged.size} flagged question{flagged.size !== 1 ? 's' : ''} — all answered. Click any to review your choice.
            </p>
          </div>
        )}

        {/* Question grid */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              All Questions — click any to go back and change your answer
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {questions.map((q, i) => {
              const answered = !!answers[q.id];
              const isFlagged = flagged.has(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => onGoTo(i)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition flex items-start gap-3"
                >
                  <div className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    isFlagged
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-400'
                      : answered
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {answered
                        ? <span className="text-xs text-green-600 font-medium">Answered: {answers[q.id]}</span>
                        : <span className="text-xs text-red-500 font-medium">Not answered</span>
                      }
                      {isFlagged && (
                        <span className="text-xs text-amber-500 flex items-center gap-0.5">
                          <Flag size={10} /> Flagged
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 mt-1 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={submitting}
          className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
        >
          <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Final Exam'}
        </button>
        <p className="text-xs text-center text-gray-400">You cannot change answers after submission.</p>
      </div>
    </div>
  );
}

// ── Main Exam Component ───────────────────────────────────────
export default function Exam() {
  const { sessionId } = useParams();
  const location = useLocation();
  const nav = useNavigate();

  const {
    questions, examType, initSession, currentIndex, answers, flagged,
    next, prev, goTo, setAnswer, toggleFlag, recordStrike, cancelExam,
    setResult, cancelled, cancelMessage, strikes,
  } = useExamStore();

  const [strikeMessage, setStrikeMessage] = useState('');
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [integrityAccepted, setIntegrityAccepted] = useState(false);
  const navStripRef = useRef(null);

  // ── Timer state lifted here so it survives review-mode toggles ──
  // ExamTimer used to own this state, but it unmounts when reviewMode=true
  // (two separate return branches), causing a reset on every review visit.
  const [timerSeconds, setTimerSeconds] = useState(null);
  const timerExpiredRef = useRef(false);
  const handleSubmitRef = useRef(null); // updated each render to avoid stale closures

  useEffect(() => {
    const { questions: qs, examType: et } = location.state || {};
    if (qs && sessionId) {
      initSession(sessionId, 'exam', et, qs);
      setReady(true);
      return;
    }
    if (!sessionId) { nav('/dashboard'); return; }
    // Refresh recovery: try sessionStorage first, then API
    const cached = sessionStorage.getItem(`exam_session_${sessionId}`);
    if (cached) {
      try {
        const { examType: cet, questions: cqs } = JSON.parse(cached);
        initSession(sessionId, 'exam', cet, cqs);
        setReady(true);
        return;
      } catch {}
    }
    // Fallback: re-fetch from backend
    api.get(`/exams/${sessionId}`).then(({ data }) => {
      initSession(sessionId, 'exam', data.examType, data.questions);
      setReady(true);
    }).catch(() => nav('/dashboard'));
  }, [sessionId]);

  // Scroll active question pill into view
  useEffect(() => {
    if (navStripRef.current) {
      const active = navStripRef.current.querySelector('[data-active="true"]');
      active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!integrityAccepted || !ready) return;
    requestFullscreen().catch(() => {});
    antiCheat.start(
      sessionId,
      (s, msg) => { recordStrike(s, msg); setStrikeMessage(msg); setShowStrikeWarning(true); },
      (msg) => { cancelExam(msg); }
    );
    return () => {
      antiCheat.stop();
      exitFullscreen();
    };
  }, [integrityAccepted, ready]);

  // Start the exam countdown once the student accepts the integrity agreement.
  // Running the interval here (not inside ExamTimer) means the countdown persists
  // across review-mode switches — ExamTimer just displays the value we pass.
  useEffect(() => {
    if (!integrityAccepted || !ready || !examType) return;
    const totalSeconds = (examType.timeLimitMinutes || 90) * 60;
    setTimerSeconds(totalSeconds);
    const id = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev === null || prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [integrityAccepted, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger auto-submit when countdown reaches zero (guard with ref to fire only once)
  useEffect(() => {
    if (timerSeconds === 0 && !timerExpiredRef.current) {
      timerExpiredRef.current = true;
      handleSubmitRef.current?.();
    }
  }, [timerSeconds]);

  const sendActivityLog = async () => {
    const log = getActivityLog();
    if (log.length === 0) return;
    try {
      await api.post(`/exams/${sessionId}/activity`, { events: log });
    } catch { /* best-effort */ }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    antiCheat.stop();
    exitFullscreen();
    await sendActivityLog();
    try {
      const { data } = await api.post(`/exams/${sessionId}/submit`, { answers });
      sessionStorage.removeItem(`exam_session_${sessionId}`);
      setResult(data);
      nav(`/results/${sessionId}`, { state: { result: data } });
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed.');
      setSubmitting(false);
    }
  };

  // Enter review mode — check for warnings first
  const enterReview = () => {
    setShowSubmitConfirm(false);
    setReviewMode(true);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // "Go back to question" from review mode
  const goBackToQuestion = (idx) => {
    goTo(idx);
    setReviewMode(false);
    window.scrollTo({ top: 0 });
  };

  if (!ready || questions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Loading exam...</div>
    </div>
  );

  // ── Integrity gate ─────────────────────────────────────────
  if (!integrityAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aws-navy px-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-aws-orange rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Exam Mode — Integrity Agreement</h1>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3 leading-relaxed mb-6">
            <p>This exam assesses your <strong>genuine knowledge and capability</strong>. Your result guides your certification readiness.</p>
            <p>By starting this exam, you agree to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-600 dark:text-gray-400">
              <li>Remain in fullscreen for the full duration</li>
              <li>Not use external resources, notes, or other applications</li>
              <li>Not share exam content with others</li>
              <li>Not open Developer Tools or attempt to inspect answers</li>
              <li>Not copy, print, or screenshot exam content</li>
            </ul>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 flex items-start gap-2">
              <Activity size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-blue-700 dark:text-blue-400 text-xs">
                <strong>Activity Monitoring:</strong> All browser and application activity during this exam is recorded — including window switches, tab changes, and blocked actions. Your instructor will have access to this report.
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mt-2">
              <p className="text-red-700 dark:text-red-400 font-medium text-xs">
                ⚠ Leaving fullscreen, switching windows, or using blocked shortcuts triggers a violation strike.
                3 strikes auto-cancel your exam and lock Exam Mode for 24 hours.
                3 incomplete exam attempts in one day locks Exam Mode for 12 hours.
              </p>
            </div>
          </div>
          <button onClick={() => setIntegrityAccepted(true)} className="btn-primary w-full py-3 text-base">
            I Agree — Begin Exam
          </button>
        </div>
      </div>
    );
  }

  // Keep ref current so the timerSeconds effect always calls the latest handleSubmit
  handleSubmitRef.current = handleSubmit;

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flagged.size;
  const unanswered = questions.length - answeredCount;
  const progress = (answeredCount / questions.length) * 100;
  const isLastQuestion = currentIndex === questions.length - 1;

  // ── Review Mode ────────────────────────────────────────────
  if (reviewMode) {
    return (
      <div className="exam-locked">
        {cancelled && <CancelledScreen message={cancelMessage} onGoHome={() => { antiCheat.stop(); nav('/dashboard'); }} />}
        <ReviewPage
          questions={questions}
          answers={answers}
          flagged={flagged}
          onGoTo={goBackToQuestion}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </div>
    );
  }

  // ── Exam Question View ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 exam-locked pb-24">
      {/* Anti-cheat modals */}
      {cancelled && <CancelledScreen message={cancelMessage} onGoHome={() => { antiCheat.stop(); nav('/dashboard'); }} />}
      {showStrikeWarning && !cancelled && (
        <StrikeWarning
          strikes={strikes}
          message={strikeMessage}
          onDismiss={() => {
            setShowStrikeWarning(false);
            reinforce(); // reset cooldown + re-enter fullscreen
          }}
        />
      )}

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-lg">Ready to Submit?</h3>
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Answered</span>
                <span className="font-semibold text-green-600">{answeredCount} / {questions.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Unanswered</span>
                <span className={`font-semibold ${unanswered > 0 ? 'text-red-500' : 'text-green-600'}`}>{unanswered}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Flagged for review</span>
                <span className="font-semibold text-amber-500">{flaggedCount}</span>
              </div>
            </div>
            {unanswered > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
                ⚠ You have <strong>{unanswered} unanswered question{unanswered !== 1 ? 's' : ''}</strong>. Unanswered questions are marked wrong.
              </p>
            )}
            {flaggedCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-3">
                You have {flaggedCount} flagged question{flaggedCount !== 1 ? 's' : ''}. Review them before submitting.
              </p>
            )}
            <p className="text-xs text-gray-400 mb-5">We recommend reviewing all your answers before submitting.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary flex-1 text-sm">
                Cancel
              </button>
              <button onClick={enterReview} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1">
                <Eye size={14} /> Review First
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 text-sm">
                {submitting ? 'Submitting...' : 'Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-aws-navy shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-aws-orange rounded flex-shrink-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[140px] sm:max-w-xs">{examType?.name}</span>
            <span className="text-gray-400 text-xs flex-shrink-0">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {flaggedCount > 0 && (
              <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
                <Flag size={12} /> {flaggedCount}
              </span>
            )}
            {strikes > 0 && (
              <span className="text-red-400 text-xs font-medium">⚠ {strikes}/3</span>
            )}
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <Activity size={11} />
              <span className="hidden sm:inline">Monitored</span>
            </div>
            <ExamTimer limitMinutes={examType?.timeLimitMinutes || 90} value={timerSeconds} />
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
            >
              <Send size={14} />
              <span className="hidden sm:inline">Submit</span>
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-aws-navy/50">
          <div className="h-1 bg-aws-orange transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <QuestionCard
          question={currentQ}
          questionIndex={currentIndex}
          totalQuestions={questions.length}
          selectedAnswer={answers[currentQ.id]}
          onAnswer={setAnswer}
          flagged={flagged.has(currentQ.id)}
          onToggleFlag={toggleFlag}
        />

        {/* Previous / Next navigation */}
        <div className="flex items-center justify-between mt-4 sm:mt-6">
          <button
            onClick={prev}
            disabled={currentIndex === 0}
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {answeredCount} / {questions.length} answered
          </span>

          {isLastQuestion ? (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <CheckCircle size={16} /> Review & Submit
            </button>
          ) : (
            <button
              onClick={next}
              className="btn-secondary flex items-center gap-1.5"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Fixed bottom question navigator strip — read-only during exam */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-20">
        <div className="max-w-6xl mx-auto px-2 sm:px-3 pt-2 pb-1">
          <div
            ref={navStripRef}
            className="flex gap-1 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {questions.map((q, i) => {
              const answered = !!answers[q.id];
              const isFlagged = flagged.has(q.id);
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={q.id}
                  data-active={isCurrent}
                  title={`Q${i + 1}${isFlagged ? ' — Flagged' : answered ? ' — Answered' : ' — Unanswered'}`}
                  className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-bold transition-all relative select-none ${
                    isCurrent
                      ? 'ring-2 ring-aws-orange bg-aws-orange text-white shadow-md scale-110'
                      : isFlagged
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-400'
                      : answered
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                  } flex items-center justify-center cursor-default`}
                >
                  {i + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-aws-orange inline-block" /> Current</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-400 inline-block" /> Answered</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400 inline-block" /> Flagged</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300 inline-block" /> Unanswered</span>
            <span className="ml-auto text-xs text-blue-400 flex items-center gap-1"><Activity size={10} /> Activity recorded</span>
          </div>
        </div>
      </div>
    </div>
  );
}
