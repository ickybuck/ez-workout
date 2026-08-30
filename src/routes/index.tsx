import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import Settings from '../pages/Settings';
import HowItWorks from '../pages/HowItWorks';
import ExerciseLibraryV2 from '../pages/ExerciseLibraryV2';
import ExerciseAdd from '../pages/ExerciseAdd';
import ExerciseEdit from '../pages/ExerciseEdit';
import Templates from '../pages/Templates';
import TemplateEdit from '../pages/TemplateEdit';
import ActiveWorkout from '../pages/ActiveWorkout';
import History from '../pages/History';
import WorkoutDetail from '../pages/WorkoutDetail';
import Admin from '../pages/Admin';
import Insights from '../pages/Insights';
import DashboardLayout from '../components/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import { SIGNUPS_ENABLED } from '../config';

const AppRoutes: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Registration is closed (see src/config.ts). Redirecting rather
          than rendering a form the API will refuse — EZ-29. */}
      <Route
        path="/register"
        element={SIGNUPS_ENABLED ? <Register /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="settings" element={<Settings />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="exercises" element={<ExerciseLibraryV2 />} />
        <Route path="exercises/new" element={<ExerciseAdd />} />
        <Route path="exercises/:id/edit" element={<ExerciseEdit />} />
        <Route path="templates" element={<Templates />} />
        <Route path="templates/new" element={<TemplateEdit />} />
        <Route path="templates/:id/edit" element={<TemplateEdit />} />
        <Route path="workout" element={<ActiveWorkout />} />
        <Route path="workout/:id" element={<WorkoutDetail />} />
        <Route path="history" element={<History />} />
        <Route path="insights" element={<Insights />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;