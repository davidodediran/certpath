import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [cohortCode, setCohortCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // mode: 'student' | 'teacher'
  const [mode, setMode] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA step state
  const [mfaStep, setMfaStep] = useState(false);   // true = show OTP input
  const [mfaToken, setMfaToken] = useState('');     // short-lived token from backend
  const [mfaCode, setMfaCode] = useState('');
  const mfaRef = useRef(null);

  const finishLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({
      email: data.email,
      isAdmin: data.isAdmin || false,
      isTeacher: data.isTeacher || false,
      name: data.name || null,
      cohort: data.cohort,
    }));
    if (data.isSuperUser) nav('/rt-super');
    else if (data.isAdmin) nav('/rt-admin');
    else if (data.isTeacher) nav('/teacher');
    else nav('/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'student') {
      if (!email.trim() || !cohortCode.trim()) {
        setError('Email and cohort code are required.');
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Email and password are required.');
        return;
      }
    }

    setLoading(true);
    try {
      await getDeviceFingerprint();
      const payload = mode === 'student'
        ? { email: email.trim(), cohortCode: cohortCode.trim() }
        : { email: email.trim(), password };

      const { data } = await api.post('/auth/login', payload);

      // Teacher MFA required — show OTP step
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        setMfaStep(true);
        setMfaCode('');
        setTimeout(() => mfaRef.current?.focus(), 100);
        return;
      }

      finishLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/verify', { mfaToken, code: mfaCode.trim() });
      finishLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-aws-navy dark:bg-gray-950 px-4">
      {/* Header */}
      <div className="mb-6 sm:mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-aws-orange rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="text-white font-bold text-xl sm:text-2xl tracking-tight">AWS Exam Platform</span>
        </div>
        <p className="text-gray-400 text-sm">Certification Practice Portal</p>
      </div>

      <div className="w-full max-w-md">

        {/* ── MFA step — shown after password success ── */}
        {mfaStep && (
          <div className="card p-5 sm:p-8">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-14 h-14 bg-aws-orange/10 rounded-2xl flex items-center justify-center mb-3">
                <ShieldCheck size={28} className="text-aws-orange" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Open your authenticator app and enter the 6-digit code for <strong>CertPath Exam Platform</strong>.
              </p>
            </div>
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Authenticator Code
                </label>
                <input
                  ref={mfaRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="000 000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                  autoComplete="one-time-code"
                  required
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Code expires in 30 seconds — enter it quickly.</p>
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setMfaStep(false); setMfaToken(''); setMfaCode(''); setError(''); }}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition mt-1"
              >
                ← Back to login
              </button>
            </form>
          </div>
        )}

        {/* ── Normal login form ── */}
        {!mfaStep && <>
        {/* Mode toggle — Student | Teacher only (Admin & Super go to direct URLs) */}
        <div className="flex mb-4 bg-aws-navy-light rounded-xl p-1 gap-1">
          {[
            { id: 'student', label: 'Student' },
            { id: 'teacher', label: 'Teacher' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                mode === id
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card p-5 sm:p-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {mode === 'teacher' ? 'Teacher Sign In' : 'Student Sign In'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {mode === 'student'
              ? 'Enter your email and cohort code to access your exam.'
              : 'Enter your teacher email and password.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email address
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {mode === 'student' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort Code
                </label>
                <input
                  type="text"
                  className="input uppercase tracking-widest"
                  placeholder="e.g. KLICT-2025"
                  value={cohortCode}
                  onChange={(e) => setCohortCode(e.target.value.toUpperCase())}
                  required
                />
                <p className="mt-1 text-xs text-gray-400">Provided by your instructor or training coordinator.</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          This platform is for authorized students and teachers only.
        </p>
        </>}
      </div>
    </div>
  );
}
