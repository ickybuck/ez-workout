import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Play, Settings, History, Layout, Library, Shield, BarChart3 } from 'lucide-react';
import { useAdminStatus } from '../hooks/useAdminStatus';

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const { isAdmin, showAdminTools } = useAdminStatus();

  const navItems = [
    { icon: Play, label: 'Start', path: '/dashboard' },
    { icon: Library, label: 'Exercises', path: '/dashboard/exercises' },
    { icon: Layout, label: 'Templates', path: '/dashboard/templates' },
    { icon: History, label: 'History', path: '/dashboard/history' },
    { icon: BarChart3, label: 'Insights', path: '/dashboard/insights' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    ...(isAdmin && showAdminTools ? [{ icon: Shield, label: 'Admin', path: '/dashboard/admin' }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main content area with bottom padding to account for navigation */}
      <main className="flex-1 pb-16">
        <div className="max-w-7xl mx-auto px-1">
          <Outlet />
        </div>
      </main>

      {/* Fixed bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
        <div className="max-w-7xl mx-auto px-1">
          <div className="flex justify-around">
            {navItems.map(({ icon: Icon, label, path }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center py-2 px-2 ${
                    isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs mt-1 text-center">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default DashboardLayout;