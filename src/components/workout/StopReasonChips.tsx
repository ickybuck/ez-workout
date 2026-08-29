import React from 'react';
import { STOP_REASONS, STOP_REASON_META, type StopReason } from '../../lib/stopReason';

interface Props {
  onChoose: (reason: StopReason) => void;
  onSkip: () => void;
  /** Skipped sets and short sets deserve slightly different wording. */
  variant: 'partial' | 'skipped';
}

/**
 * One tap to say why a set ended.
 *
 * Shown only when something is already known to be off — a set cut short or
 * one not started — so a normal session never sees it. At thirty sets a
 * session, a prompt on every set gets ignored within a week, and an ignored
 * prompt leaves gaps that are not random, which is worse than no data.
 *
 * Large targets on purpose: this is tapped standing up, one-handed, holding a
 * phone, usually out of breath. Anything that needs aim will get the nearest
 * button rather than the true one.
 *
 * The skip is deliberate and deliberately quiet. Forcing a choice produces
 * confident garbage, and a null that means "not recorded" is worth more than a
 * value that means "whatever was closest to my thumb".
 */
const StopReasonChips: React.FC<Props> = ({ onChoose, onSkip, variant }) => (
  <div className="mt-3 pt-3 border-t border-gray-200">
    <p className="text-xs font-medium text-gray-600 mb-2">
      {variant === 'skipped' ? 'Why was this set skipped?' : 'Why did the set stop?'}
    </p>

    <div className="grid grid-cols-2 gap-2">
      {STOP_REASONS.map((reason) => (
        <button
          key={reason}
          onClick={() => onChoose(reason)}
          title={STOP_REASON_META[reason].meaning}
          className="py-2.5 px-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors text-left"
        >
          {STOP_REASON_META[reason].label}
        </button>
      ))}
    </div>

    <button
      onClick={onSkip}
      className="mt-2 w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      Skip — don’t record a reason
    </button>
  </div>
);

export default StopReasonChips;
