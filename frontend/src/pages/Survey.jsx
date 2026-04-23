import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { Star, CheckCircle, ChevronLeft } from 'lucide-react';

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition"
        >
          <Star
            size={28}
            className={`${n <= (hover || value) ? 'fill-aws-orange text-aws-orange' : 'text-gray-300 dark:text-gray-600'} transition`}
          />
        </button>
      ))}
    </div>
  );
}

export default function Survey() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({
    difficultyRating: 0,
    contentQualityRating: 0,
    foundUnclearQuestions: false,
    unclearDetails: '',
    suggestions: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/surveys', { examSessionId: sessionId, ...form });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit survey.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="card p-8 max-w-md text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          Your feedback helps us improve the exam platform for all students. We really appreciate it.
        </p>
        <button onClick={() => nav('/dashboard')} className="btn-primary w-full">
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => nav(`/results/${sessionId}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-aws-orange mb-6 transition">
          <ChevronLeft size={16} /> Back to Results
        </button>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Exam Feedback Survey</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Help us improve this platform. All responses are anonymous and optional.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How difficult was this exam?
              </label>
              <StarRating value={form.difficultyRating} onChange={(v) => setForm((f) => ({ ...f, difficultyRating: v }))} />
              <p className="text-xs text-gray-400 mt-1">1 = Very Easy, 5 = Very Difficult</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How well did the questions reflect real exam content?
              </label>
              <StarRating value={form.contentQualityRating} onChange={(v) => setForm((f) => ({ ...f, contentQualityRating: v }))} />
              <p className="text-xs text-gray-400 mt-1">1 = Not at all, 5 = Very accurately</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Did you encounter any unclear or incorrect questions?
              </label>
              <div className="flex gap-3">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, foundUnclearQuestions: v }))}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition ${
                      form.foundUnclearQuestions === v
                        ? 'bg-aws-orange text-white border-aws-orange'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            {form.foundUnclearQuestions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Please describe the issue (optional)
                </label>
                <textarea
                  className="input h-24 resize-none"
                  placeholder="Question number, what was unclear or incorrect..."
                  value={form.unclearDetails}
                  onChange={(e) => setForm((f) => ({ ...f, unclearDetails: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Any suggestions to improve this platform? (optional)
              </label>
              <textarea
                className="input h-24 resize-none"
                placeholder="Your suggestions are valuable..."
                value={form.suggestions}
                onChange={(e) => setForm((f) => ({ ...f, suggestions: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => nav('/dashboard')} className="btn-secondary flex-1">
                Skip
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
