import React, { useState } from 'react';
import { BarChart3, TrendingUp, AlertCircle, Award, Layout, Calendar } from 'lucide-react';
import Overview from './insights/Overview';
import Progress from './insights/Progress';
import Plateaus from './insights/Plateaus';
import Records from './insights/Records';
import Templates from './insights/Templates';

type InsightView = 'overview' | 'progress' | 'plateaus' | 'records' | 'templates';

const Insights: React.FC = () => {
  const [activeView, setActiveView] = useState<InsightView>('overview');
  const [timeRange, setTimeRange] = useState<'30' | '90' | '180' | 'all'>('30');

  const insightsNavItems = [
    { id: 'overview' as InsightView, icon: BarChart3, label: 'Overview' },
    { id: 'progress' as InsightView, icon: TrendingUp, label: 'Progress' },
    { id: 'plateaus' as InsightView, icon: AlertCircle, label: 'Plateaus' },
    { id: 'records' as InsightView, icon: Award, label: 'Records' },
    { id: 'templates' as InsightView, icon: Layout, label: 'Templates' },
  ];

  const timeRangeOptions = [
    { value: '30' as const, label: '30D' },
    { value: '90' as const, label: '90D' },
    { value: '180' as const, label: '6M' },
    { value: 'all' as const, label: 'All' },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return <Overview timeRange={timeRange} />;
      case 'progress':
        return <Progress timeRange={timeRange} />;
      case 'plateaus':
        return <Plateaus timeRange={timeRange} />;
      case 'records':
        return <Records timeRange={timeRange} />;
      case 'templates':
        return <Templates timeRange={timeRange} />;
      default:
        return <Overview timeRange={timeRange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Workout Insights</h1>
        {renderContent()}
      </div>

      {/* Secondary insights navigation - fixed above main navbar */}
      <nav className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-1 overflow-x-auto">
            {insightsNavItems.map(({ id, icon: Icon, label }) => {
              const isActive = activeView === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveView(id)}
                  className={`flex flex-col items-center py-2 px-2 min-w-[60px] ${
                    isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] mt-0.5 text-center">{label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-shrink-0 ml-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '30' | '90' | '180' | 'all')}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">30D</option>
              <option value="90">90D</option>
              <option value="180">6M</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Insights;
