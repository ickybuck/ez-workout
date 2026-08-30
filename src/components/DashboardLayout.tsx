import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Play, Settings, History, Layout, Library, Shield, BarChart3 } from 'lucide-react';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { useOnboarding } from '../hooks/useOnboarding';
import Onboarding from '../pages/Onboarding';

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const { isAdmin, showAdminTools } = useAdminStatus();
  const { status: onboarding, markDone } = useOnboarding();

  const navItems = [
    { icon: Play, label: 'Start', path: '/dashboard' },
    { icon: Library, label: 'Exercises', path: '/dashboard/exercises' },
    { icon: Layout, label: 'Templates', path: '/dashboard/templates' },
    { icon: History, label: 'History', path: '/dashboard/history' },
    { icon: BarChart3, label: 'Insights', path: '/dashboard/insights' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    ...(isAdmin && showAdminTools ? [{ icon: Shield, label: 'Admin', path: '/dashboard/admin' }] : []),
  ];

  /*
   * Setup takes over the whole screen rather than living at its own route.
   *
   * A route would need a redirect from every other route to be inescapable,
   * and the moment one of those redirects disagreed with the guard we would
   * have a loop. Rendering in place of the outlet cannot loop: there is one
   * condition, in one file, and the navigation is not reachable while it holds.
   *
   * 'loading' renders nothing at all. Showing the app and then replacing it a
   * beat later would flash the dashboard at someone who has never seen it.
   */
  if (onboarding === 'loading') return null;
  if (onboarding === 'needed') return <Onboarding onDone={markDone} />;

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Main content area with bottom padding to account for navigation */}
      <main className="flex-1 pb-16">
        <div className="max-w-7xl mx-auto px-1">
          <Outlet />
        </div>
      </main>

      {/* Fixed bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-edge safe-area-bottom z-50">
        <div className="max-w-7xl mx-auto px-1">
          <div className="flex justify-around">
            {navItems.map(({ icon: Icon, label, path }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center py-2 px-2 ${
                    isActive ? 'text-accent' : 'text-content-muted hover:text-content'
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