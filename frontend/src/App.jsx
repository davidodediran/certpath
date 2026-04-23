import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import SuperLogin from './pages/SuperLogin';
import Dashboard from './pages/Dashboard';
import ModeSelect from './pages/ModeSelect';
import Exam from './pages/Exam';
import PracticeExam from './pages/PracticeExam';
import Results from './pages/Results';
import Review from './pages/Review';
import Survey from './pages/Survey';
import Admin from './pages/Admin';
import SuperUser from './pages/SuperUser';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentPerformance from './pages/StudentPerformance';
import QuestionReview from './pages/QuestionReview';
import { initFontScale } from './lib/fontScale';

// Apply saved font scale and theme immediately on load
initFontScale();
(function initTheme() {
  const dark = localStorage.getItem('theme') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
})();

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/rt-admin/login" replace />;
  if (!user.isAdmin) return <Navigate to="/rt-admin/login" replace />;
  return children;
}

function SuperUserRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/rt-super/login" replace />;
  if (!user.isSuperUser) return <Navigate to="/rt-super/login" replace />;
  return children;
}

function TeacherRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  if (!user.isTeacher && !user.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Student / Teacher login */}
        <Route path="/login" element={<Login />} />

        {/* Admin portal */}
        <Route path="/rt-admin/login" element={<AdminLogin />} />
        <Route path="/rt-admin" element={<AdminRoute><Admin /></AdminRoute>} />

        {/* Superuser portal — separate login */}
        <Route path="/rt-super/login" element={<SuperLogin />} />
        <Route path="/rt-super" element={<SuperUserRoute><SuperUser /></SuperUserRoute>} />

        {/* Student routes */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/exam/:examTypeId/mode" element={<PrivateRoute><ModeSelect /></PrivateRoute>} />
        <Route path="/exam/:sessionId/take" element={<PrivateRoute><Exam /></PrivateRoute>} />
        <Route path="/practice/:sessionId/take" element={<PrivateRoute><PracticeExam /></PrivateRoute>} />
        <Route path="/results/:sessionId" element={<PrivateRoute><Results /></PrivateRoute>} />
        <Route path="/results/:sessionId/review" element={<PrivateRoute><Review /></PrivateRoute>} />
        <Route path="/results/:sessionId/survey" element={<PrivateRoute><Survey /></PrivateRoute>} />

        {/* Teacher routes */}
        <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
        <Route path="/teacher/students/:studentId" element={<TeacherRoute><StudentPerformance /></TeacherRoute>} />
        <Route path="/teacher/questions/review" element={<TeacherRoute><QuestionReview /></TeacherRoute>} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
