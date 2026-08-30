import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface Action {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface Props {
  icon: LucideIcon;
  title: string;
  /** What this screen is for, in a sentence someone can act on. */
  children: React.ReactNode;
  action?: Action;
  secondary?: Action;
}

/**
 * What a screen says when it has nothing to show.
 *
 * These do most of the work a first-run tour would do, at a fraction of the
 * cost, and they keep doing it — a carousel is seen once and never again, while
 * an empty Templates screen explains itself every time someone arrives with
 * nothing there. That includes the same person a year later, wondering how a
 * feature they never used works.
 *
 * So the copy explains the CONCEPT, not the button. "No templates yet" tells
 * someone what they can already see.
 */
const EmptyState: React.FC<Props> = ({ icon: Icon, title, children, action, secondary }) => {
  const button = (a: Action, primary: boolean) => {
    const className = primary
      ? 'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-content-inverse hover:bg-accent-hover transition-colors'
      : 'inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium border border-edge-strong text-content-muted hover:bg-surface transition-colors';

    return a.to ? (
      <Link to={a.to} className={className}>
        {a.label}
      </Link>
    ) : (
      <button onClick={a.onClick} className={className}>
        {a.label}
      </button>
    );
  };

  return (
    <div className="max-w-md mx-auto text-center px-6 py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-soft mb-4">
        <Icon className="h-6 w-6 text-accent" />
      </div>

      <h3 className="text-lg font-medium text-content mb-2">{title}</h3>

      <div className="text-sm text-content-muted space-y-2 mb-4">{children}</div>

      {(action || secondary) && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {action && button(action, true)}
          {secondary && button(secondary, false)}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
