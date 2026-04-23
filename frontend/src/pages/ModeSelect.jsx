import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { Shield, BookOpen, Clock, ChevronLeft, AlertTriangle } from 'lucide-react';

export default function ModeSelect() {
  const { examTypeId } = useParams();
  const nav = useNavigate();
  const [examType, setExamType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/exam-types').then((r) => {
      const et = r.data.find((e) => String(e.id) === String(examTypeId));
      setExamType(et);
    });
  }, [examTypeId]);

  const startExam = async (mode) => {
    setLoading(true);
    setError('');
    try {
      const fp = await getDeviceFingerprint();
      const { data } = await api.post('/exams/start', { examTypeId: Number(examTypeId), mode });
      // Persist session data so page refresh can recover without redirecting to dashboard
      sessionStorage.setItem(`exam_session_${data.sessionId}`, JSON.stringify({
        examType: data.examType,
        questions: data.questions,
        startedAt: Date.now(),
      }));
      if (mode === 'exam') {
        nav(`/exam/${data.sessionId}/take`, { state: { examType: data.examType, questions: data.questions } });
      } else {
        nav(`/practice/${data.sessionId}/take`, { state: { examType: data.examType, questions: data.questions } });
      }
    } catch (err) {
      const errCode = err.response?.data?.error;
      if (errCode === 'session_invalid') {
        localStorage.clear();
        nav('/login');
        return;
      } else if (errCode === 'exam_locked' || errCode === 'attempt_lockout') {
        const until = new Date(err.response.data.lockedUntil);
        setLockout({ until, isAttemptLockout: errCode === 'attempt_lockout' });
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || 'Failed to start exam. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!examType) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <button onClick={() => nav('/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-aws-orange mb-6 transition">
          <ChevronLeft size={16} /> Back to Dashboard
        </button>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{examType.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{examType.questionsPerExam} questions · {examType.timeLimitMinutes} minutes · Passing score: {examType.passingScore}/1000</p>
        </div>

        {lockout && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
            <div className="flex gap-3 text-red-700 dark:text-red-400">
              <AlertTriangle size={22} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {lockout.isAttemptLockout ? 'Exam Mode Temporarily Locked' : 'Exam Mode Suspended'}
                </p>
                <p className="text-sm mt-1">
                  {lockout.isAttemptLockout
                    ? 'You have had 3 incomplete exam attempts today. Take a break and revisit the material.'
                    : 'Due to anti-cheat violations, your Exam Mode access is suspended.'}
                </p>
                <p className="text-sm font-semibold mt-1.5">Unlocks: {lockout.until.toLocaleString()}</p>
                {lockout.isAttemptLockout && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-blue-700 dark:text-blue-300 text-xs font-medium">
                      💡 We recommend using <strong>Practice Mode</strong> while Exam Mode is locked.
                      Practice Mode shows explanations after each answer to help you learn faster.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Practice Mode */}
          <div className="card p-6 hover:shadow-md transition border-2 border-transparent hover:border-blue-400">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
              <BookOpen size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Practice Mode</h2>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 mb-6">
              <li className="flex items-center gap-2">✓ No time limit</li>
              <li className="flex items-center gap-2">✓ Answers shown after each question</li>
              <li className="flex items-center gap-2">✓ Full explanations and references</li>
              <li className="flex items-center gap-2">✓ No anti-cheat restrictions</li>
              <li className="flex items-center gap-2">✓ Unlimited retakes</li>
            </ul>
            <button
              onClick={() => startExam('practice')}
              disabled={loading}
              className="w-full btn-secondary"
            >
              {loading ? 'Starting...' : 'Start Practice'}
            </button>
          </div>

          {/* Exam Mode */}
          <div className="card p-6 hover:shadow-md transition border-2 border-transparent hover:border-aws-orange">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-4">
              <Shield size={24} className="text-aws-orange" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Exam Mode</h2>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 mb-6">
              <li className="flex items-center gap-2"><Clock size={13} /> {examType.timeLimitMinutes}-minute timer</li>
              <li className="flex items-center gap-2">✓ AWS-style score report</li>
              <li className="flex items-center gap-2">✓ Downloadable PDF certificate</li>
              <li className="flex items-center gap-2 text-red-500 dark:text-red-400">⚠ Anti-cheat enforced</li>
              <li className="flex items-center gap-2 text-red-500 dark:text-red-400">⚠ 3 violations = auto-cancel</li>
            </ul>
            <button
              onClick={() => startExam('exam')}
              disabled={loading || !!lockout}
              className="w-full btn-primary"
            >
              {loading ? 'Starting...' : lockout ? 'Locked' : 'Start Exam'}
            </button>
          </div>
        </div>

        {/* Integrity notice */}
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">Academic Integrity Notice</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            This exam is designed to assess your genuine knowledge and capability as an AWS practitioner. Please be honest — the score reflects your real ability and is used to guide your learning. Using external resources, switching windows, or sharing content during Exam Mode will result in immediate cancellation and a temporary lockout.
          </p>
        </div>
      </div>
    </div>
  );
}
