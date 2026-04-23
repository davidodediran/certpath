import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useExamStore } from '../store/examStore';
import api from '../lib/api';
import QuestionCard from '../components/QuestionCard';
import NavigationPanel from '../components/NavigationPanel';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, Flag, Grid } from 'lucide-react';

export default function PracticeExam() {
  const { sessionId } = useParams();
  const location = useLocation();
  const nav = useNavigate();

  const {
    questions, examType, initSession, currentIndex, answers, flagged,
    next, prev, goTo, setAnswer, toggleFlag, setResult,
  } = useExamStore();

  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  useEffect(() => {
    const { questions: qs, examType: et } = location.state || {};
    if (qs && sessionId) {
      initSession(sessionId, 'practice', et, qs);
      setReady(true);
      return;
    }
    if (!sessionId) { nav('/dashboard'); return; }
    // Refresh recovery: try sessionStorage first, then API
    const cached = sessionStorage.getItem(`exam_session_${sessionId}`);
    if (cached) {
      try {
        const { examType: cet, questions: cqs } = JSON.parse(cached);
        initSession(sessionId, 'practice', cet, cqs);
        setReady(true);
        return;
      } catch {}
    }
    // Fallback: re-fetch from backend
    api.get(`/exams/${sessionId}`).then(({ data }) => {
      initSession(sessionId, 'practice', data.examType, data.questions);
      setReady(true);
    }).catch(() => nav('/dashboard'));
  }, [sessionId]);

  const handleAnswer = (questionId, label) => {
    setAnswer(questionId, label);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      const { data } = await api.post(`/exams/${sessionId}/submit`, { answers });
      sessionStorage.removeItem(`exam_session_${sessionId}`);
      setResult(data);
      nav(`/results/${sessionId}`, { state: { result: data } });
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || questions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Loading practice session...</div>
    </div>
  );

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const unanswered = questions.length - answeredCount;
  const flaggedCount = flagged.size;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-lg">Submit Practice Session?</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Answered</span>
                <span className="font-semibold text-green-600">{answeredCount} / {questions.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Unanswered</span>
                <span className={`font-semibold ${unanswered > 0 ? 'text-amber-500' : 'text-green-600'}`}>{unanswered}</span>
              </div>
              {flaggedCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Flagged</span>
                  <span className="font-semibold text-amber-500">{flaggedCount}</span>
                </div>
              )}
            </div>

            {unanswered > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  You still have <strong>{unanswered} unanswered question{unanswered !== 1 ? 's' : ''}</strong>. You can continue practising or submit now — unanswered questions will be marked wrong.
                </p>
              </div>
            )}
            {flaggedCount > 0 && unanswered === 0 && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 mb-3">
                <Flag size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  You have {flaggedCount} flagged question{flaggedCount !== 1 ? 's' : ''} you may want to revisit before submitting.
                </p>
              </div>
            )}

            <p className="text-xs text-gray-400 mb-5">You cannot change your answers after submission.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary flex-1 text-sm">
                Continue
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 text-sm">
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile navigator drawer */}
      {showMobileNav && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileNav(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Question Navigator</span>
              <button onClick={() => setShowMobileNav(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">✕</button>
            </div>
            <NavigationPanel
              questions={questions}
              answers={answers}
              flagged={flagged}
              currentIndex={currentIndex}
              onGoTo={(i) => { goTo(i); setShowMobileNav(false); }}
              cols={8}
              maxH="max-h-none"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-aws-navy shadow-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => nav('/dashboard')} className="text-gray-400 hover:text-white transition flex-shrink-0">
              <ChevronLeft size={20} />
            </button>
            <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[140px] sm:max-w-xs">
              Practice: {examType?.name}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-gray-400 text-xs sm:text-sm">{answeredCount}/{questions.length}</span>
            {/* Mobile nav toggle */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="lg:hidden text-gray-400 hover:text-white transition p-1"
              title="Question navigator"
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submitting}
              className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
            >
              <Send size={14} />
              <span className="hidden sm:inline">{submitting ? 'Submitting...' : 'Submit'}</span>
            </button>
          </div>
        </div>
        <div className="h-1 bg-aws-navy-dark">
          <div className="h-1 bg-blue-500 transition-all duration-300" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid lg:grid-cols-[1fr_220px] gap-4 sm:gap-6">
        <div>
          <QuestionCard
            question={currentQ}
            questionIndex={currentIndex}
            totalQuestions={questions.length}
            selectedAnswer={answers[currentQ.id]}
            onAnswer={handleAnswer}
            flagged={flagged.has(currentQ.id)}
            onToggleFlag={toggleFlag}
          />

          <div className="flex items-center justify-between mt-4">
            <button onClick={prev} disabled={currentIndex === 0} className="btn-secondary flex items-center gap-1.5 disabled:opacity-40">
              <ChevronLeft size={16} /> Previous
            </button>
            <button onClick={next} disabled={currentIndex === questions.length - 1} className="btn-secondary flex items-center gap-1.5 disabled:opacity-40">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="hidden lg:block">
          <NavigationPanel
            questions={questions}
            answers={answers}
            flagged={flagged}
            currentIndex={currentIndex}
            onGoTo={goTo}
          />
        </div>
      </div>
    </div>
  );
}
