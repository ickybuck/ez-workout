import { describe, it, expect } from 'vitest';
import {
  classifySet,
  performedReps,
  extraReps,
  shouldPromptForReason,
  shouldPromptForRir,
  suggestsLoadIncrease,
  summariseSets,
  hasCauseData,
  mayInformLoad,
  tallyReasons,
  isStopReason,
  isRirBand,
  STOP_REASONS,
  STOP_REASON_META,
  type SetLike,
} from './stopReason';

/** Defaults mirror how the app writes a set: reps is the TARGET, not the count. */
const set = (over: Partial<SetLike> = {}): SetLike => ({
  reps: 10,
  failed_reps: 0,
  ...over,
});

describe('performed reps', () => {
  it('subtracts the shortfall from the prescription', () => {
    // The column names invite the opposite reading and have caused two
    // rounds of wrong analysis. reps is the target; performed is the difference.
    expect(performedReps(set({ reps: 20, failed_reps: 10 }))).toBe(10);
  });

  it('adds reps carried past the target', () => {
    expect(performedReps(set({ reps: 10, extra_reps: 2 }))).toBe(12);
  });

  it('treats missing values as zero rather than NaN', () => {
    expect(performedReps({ reps: null, failed_reps: null })).toBe(0);
    expect(performedReps(set({ failed_reps: null }))).toBe(10);
  });

  it('never returns a negative count even if the data is nonsense', () => {
    expect(performedReps(set({ reps: 10, failed_reps: 25 }))).toBe(0);
  });

  it('ignores a negative overage rather than subtracting it', () => {
    expect(performedReps(set({ reps: 10, extra_reps: -3 }))).toBe(10);
    expect(extraReps(set({ extra_reps: -3 }))).toBe(0);
  });
});

describe('classifying a set', () => {
  it.each([
    ['complete', set()],
    ['partial', set({ failed_reps: 4 })],
    ['skipped', set({ failed_reps: 10 })],
    ['exceeded', set({ extra_reps: 2 })],
  ] as const)('reads %s', (expected, input) => {
    expect(classifySet(input)).toBe(expected);
  });

  it('treats a set with nothing performed as skipped, not failed', () => {
    // The distinction the whole module exists for. 52.9% of recorded "failed
    // reps" were sets like this, and counting them as failures was wrong by
    // roughly half.
    expect(classifySet(set({ reps: 20, failed_reps: 20 }))).toBe('skipped');
  });

  it('treats a set with no prescription as skipped', () => {
    expect(classifySet({ reps: 0, failed_reps: 0 })).toBe('skipped');
    expect(classifySet({ reps: null, failed_reps: null })).toBe('skipped');
  });
});

describe('when to ask why', () => {
  it('asks on a short set and on a skipped one', () => {
    expect(shouldPromptForReason(set({ failed_reps: 3 }))).toBe(true);
    expect(shouldPromptForReason(set({ failed_reps: 10 }))).toBe(true);
  });

  it('stays out of the way on a normal set', () => {
    // Thirty sets a session. A prompt on every one gets abandoned within a
    // week, and abandoned prompts leave gaps that are not random.
    expect(shouldPromptForReason(set())).toBe(false);
  });

  it('does not ask when the set was beaten', () => {
    expect(shouldPromptForReason(set({ extra_reps: 3 }))).toBe(false);
  });
});

describe('when to ask for reps in reserve', () => {
  const opts = { isLastSet: true, isLoaded: true };

  it('asks on the last completed set of a loaded exercise', () => {
    expect(shouldPromptForRir(set(), opts)).toBe(true);
  });

  it('does not ask on earlier sets', () => {
    expect(shouldPromptForRir(set(), { ...opts, isLastSet: false })).toBe(false);
  });

  it('does not ask on unloaded work, where the answer means nothing', () => {
    expect(shouldPromptForRir(set(), { ...opts, isLoaded: false })).toBe(false);
  });

  it('does not ask when the set was already beaten', () => {
    // Overage measured it. Asking for an estimate of something just counted
    // is friction for worse data.
    expect(shouldPromptForRir(set({ extra_reps: 2 }), opts)).toBe(false);
  });

  it('does not ask on a set that fell short', () => {
    expect(shouldPromptForRir(set({ failed_reps: 3 }), opts)).toBe(false);
  });
});

describe('evidence the load is too light', () => {
  it('counts reps beyond the target', () => {
    expect(suggestsLoadIncrease(set({ extra_reps: 1 }))).toBe(true);
  });

  it('counts a clean set left three or more in reserve', () => {
    expect(suggestsLoadIncrease(set({ set_rir: '3plus' }))).toBe(true);
  });

  it('does not count a bare clean completion', () => {
    // The squat case: 275 lb completed cleanly fourteen times running is
    // evidence that nothing was asked, not that the load was right.
    expect(suggestsLoadIncrease(set())).toBe(false);
  });

  it('does not count a set that fell short', () => {
    expect(suggestsLoadIncrease(set({ failed_reps: 2 }))).toBe(false);
    expect(suggestsLoadIncrease(set({ failed_reps: 2, set_rir: '3plus' }))).toBe(false);
  });
});

describe('summarising a group of sets', () => {
  it('keeps skipped and partial apart', () => {
    // Modelled on the real Split Squats history: mostly full, one session cut.
    const sets = [
      set({ reps: 20 }),
      set({ reps: 20 }),
      set({ reps: 20, failed_reps: 20 }),
      set({ reps: 20, failed_reps: 4 }),
    ];
    const s = summariseSets(sets);

    expect(s.complete).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.partial).toBe(1);
    expect(s.skippedReps).toBe(20);
    expect(s.genuinePartialReps).toBe(4);
  });

  it('computes the partial rate over started sets only', () => {
    // The correction that moved Split Squats from 18.3% to 4.9%. Including
    // skipped sets in the denominator inflates the fatigue signal with work
    // that was never attempted.
    const sets = [
      set({ reps: 20 }),
      set({ reps: 20 }),
      set({ reps: 20, failed_reps: 20 }),
      set({ reps: 20, failed_reps: 4 }),
    ];
    const s = summariseSets(sets);

    // 4 missed over 60 prescribed on started sets, not over 80.
    expect(s.genuinePartialRate).toBeCloseTo(4 / 60, 6);
    expect(s.skipRate).toBeCloseTo(0.25, 6);
  });

  it('counts exceeded sets and the reps behind them', () => {
    const s = summariseSets([set({ extra_reps: 2 }), set({ extra_reps: 3 }), set()]);
    expect(s.exceeded).toBe(2);
    expect(s.extraReps).toBe(5);
    expect(s.complete).toBe(1);
    expect(s.performedReps).toBe(35);
  });

  it('does not count overage as missed reps', () => {
    const s = summariseSets([set({ extra_reps: 5 })]);
    expect(s.genuinePartialReps).toBe(0);
    expect(s.skippedReps).toBe(0);
  });

  it('tracks how much cause data exists, without inventing any', () => {
    const s = summariseSets([
      set({ failed_reps: 3, stop_reason: 'muscular_failure' }),
      set({ failed_reps: 10 }),
      set(),
    ]);
    expect(s.reasonsExpected).toBe(2);
    expect(s.reasonsRecorded).toBe(1);
  });

  it('returns zeroes rather than NaN for an empty group', () => {
    const s = summariseSets([]);
    expect(s.sets).toBe(0);
    expect(s.genuinePartialRate).toBe(0);
    expect(s.skipRate).toBe(0);
  });
});

describe('cause data is never inferred', () => {
  it('reports no cause for the seventeen months logged before this shipped', () => {
    expect(hasCauseData(set({ failed_reps: 4 }))).toBe(false);
  });

  it('rejects a value that is not a known reason', () => {
    expect(hasCauseData(set({ stop_reason: 'breathless_nausea' }))).toBe(false);
    expect(isStopReason('tired')).toBe(false);
    expect(isStopReason(null)).toBe(false);
  });

  it('accepts every reason it defines', () => {
    for (const reason of STOP_REASONS) expect(isStopReason(reason)).toBe(true);
  });

  it('validates rir bands', () => {
    expect(isRirBand('1-2')).toBe(true);
    expect(isRirBand('4')).toBe(false);
  });
});

describe('only muscular failure may move a load', () => {
  it('lets muscular failure through', () => {
    expect(mayInformLoad(set({ stop_reason: 'muscular_failure' }))).toBe(true);
  });

  it.each(['out_of_time', 'daily_depletion', 'session_depletion', 'deprioritised', 'discomfort'] as const)(
    'blocks %s',
    (reason) => {
      // The guard that makes the ratchet safe: a session cut short for any of
      // these is not evidence the weight was easy.
      expect(mayInformLoad(set({ stop_reason: reason }))).toBe(false);
    },
  );

  it('blocks an unrecorded reason', () => {
    expect(mayInformLoad(set({ failed_reps: 3 }))).toBe(false);
  });
});

describe('the two kinds of depletion stay separate', () => {
  it('does not treat them as the same reason', () => {
    // One says fix recovery, the other says fix readiness. Merging them
    // recreates the conflation this module exists to end.
    expect(STOP_REASON_META.session_depletion.label).not.toBe(
      STOP_REASON_META.daily_depletion.label,
    );
    const tally = tallyReasons([
      set({ stop_reason: 'session_depletion' }),
      set({ stop_reason: 'session_depletion' }),
      set({ stop_reason: 'daily_depletion' }),
    ]);
    expect(tally.session_depletion).toBe(2);
    expect(tally.daily_depletion).toBe(1);
  });

  it('excludes running out of time from training signals', () => {
    expect(STOP_REASON_META.out_of_time.isTrainingSignal).toBe(false);
  });

  it('counts nothing for sets with no recorded reason', () => {
    const tally = tallyReasons([set(), set({ failed_reps: 4 })]);
    expect(Object.values(tally).every((n) => n === 0)).toBe(true);
  });
});
