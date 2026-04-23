import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const mfaRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (token && user.isAdmin && !user.isSuperUser) nav('/rt-admin', { replace: true });
    if (token && user.isSuperUser) nav('/rt-super', { replace: true });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      if (data.isSuperUser) { setError('Superuser accounts must use the Superuser Portal.'); return; }
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        setMfaStep(true);
        setMfaCode('');
        setTimeout(() => mfaRef.current?.focus(), 100);
        return;
      }
      if (!data.isAdmin) { setError('This portal is for admin accounts only.'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ email: data.email, isAdmin: true, name: data.name || null }));
      nav('/rt-admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) { setError('Enter the 6-digit code.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/verify', { mfaToken, code: mfaCode.trim() });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ email: data.email, isAdmin: true }));
      nav('/rt-admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-aws-navy dark:bg-gray-950 px-4">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <ShieldCheck size={28} className="text-white" />
        </div>
        <h1 className="text-white font-bold text-2xl tracking-tight">Admin Portal</h1>
        <p className="text-gray-400 text-sm mt-1">Restricted access — authorized personnel only</p>
      </div>

      <div className="w-full max-w-sm">
        {/* MFA step */}
        {mfaStep && (
          <div className="card p-8">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-3">
                <ShieldCheck size={28} className="text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enter the 6-digit code from your authenticator app.</p>
            </div>
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <input
                ref={mfaRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                className="input text-center text-2xl tracking-widest font-mono w-full"
                placeholder="000 000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                autoComplete="one-time-code"
              />
              {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>}
              <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-60">
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button type="button" onClick={() => { setMfaStep(false); setMfaToken(''); setMfaCode(''); setError(''); }}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition">← Back to login</button>
            </form>
          </div>
        )}

        {!mfaStep && <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                className="input"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60">
              <Lock size={16} />
              {loading ? 'Signing in...' : 'Sign In to Admin'}
            </button>
          </form>
        </div>}
        <div className="mt-6 space-y-1 text-center text-xs text-gray-500">
          <p>
            <button onClick={() => nav('/login')} className="text-gray-400 hover:text-white underline transition">← Student / Teacher login</button>
          </p>
          <p>
            <button onClick={() => nav('/rt-super/login')} className="text-gray-400 hover:text-white underline transition">Superuser Portal →</button>
          </p>
        </div>
      </div>
    </div>
  );
}
