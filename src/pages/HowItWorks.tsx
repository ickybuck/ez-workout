import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Library, Layout, Play, History, BarChart3, Link2 } from 'lucide-react';

interface StepProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ icon: Icon, title, children }) => (
  <section className="flex gap-4">
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center">
      <Icon className="h-4 w-4 text-accent" />
    </div>
    <div className="min-w-0">
      <h3 className="text-base font-medium text-content mb-1">{title}</h3>
      <div className="text-sm text-content-muted space-y-2">{children}</div>
    </div>
  </section>
);

/**
 * How the app works, in the order someone meets it.
 *
 * Reachable from Settings rather than shown once at signup, because the
 * questions it answers are not only first-day questions. "Can a template mix
 * supersets with straight sets" is asked by someone who has used the app for a
 * year and never needed to know.
 *
 * It explains the two things that are genuinely not discoverable: that a
 * template can be built from either end, and that exercise ORDER carries
 * meaning — both for pairing complementary movements and for the physical
 * layout of a particular gym. Nothing in the interface hints at the second, and
 * it is the sort of thing only the person who built the routine knows.
 */
const HowItWorks: React.FC = () => (
  <div className="py-6 max-w-2xl mx-auto px-4">
    <Link
      to="/dashboard/settings"
      className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      Settings
    </Link>

    <h2 className="text-2xl font-bold text-content mb-2">How this works</h2>
    <p className="text-sm text-content-muted mb-8">
      Five steps, roughly in the order you will meet them.
    </p>

    <div className="space-y-8">
      <Step icon={User} title="1. Tell it about you">
        <p>
          Units, body weight, and which plates your gym actually has. The plate
          list is what lets the app tell you how to load a bar, so it is worth
          getting right — it is under Settings, Units &amp; Plates.
        </p>
      </Step>

      <Step icon={Library} title="2. The exercise library">
        <p>
          Every movement lives here once, with its equipment and the muscles it
          works. Templates point at these rather than owning their own copies,
          so changing an exercise updates it everywhere.
        </p>
        <p>
          Search before adding. Most things are already there under a slightly
          different name, and a second copy splits your history in two.
        </p>
      </Step>

      <Step icon={Layout} title="3. Build a template">
        <p>There are two ways in, and neither is more correct:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Start a template and add exercises to it from the builder.
          </li>
          <li>
            Or browse the exercise library and add movements to a template as
            you come across them.
          </li>
        </ul>
        <p>
          Each exercise carries its own sets, reps and starting weight, which
          become the defaults when you train.
        </p>
      </Step>

      <Step icon={Link2} title="4. Pair what belongs together, and mind the order">
        <p>
          Tap the link between two exercises to superset them — performed
          together, with one rest after the pair. Unlinked exercises are
          straight sets with their own rest. A template can mix both freely.
        </p>
        <p>
          <span className="text-content font-medium">Order matters more than it looks.</span>{' '}
          It decides which movements sit next to each other, and it is worth
          arranging around the room you actually train in: exercises sharing a
          rack or a corner belong together, so you are not crossing the floor
          between sets.
        </p>
      </Step>

      <Step icon={Play} title="5. Run the workout">
        <p>
          Start a template and work down it. Log each set as{' '}
          <span className="text-content font-medium">Complete</span>, or{' '}
          <span className="text-content font-medium">More</span> if you went past
          the target, or <span className="text-content font-medium">Partial</span>{' '}
          if you came up short — and if you did, it asks why in one tap.
        </p>
        <p>
          That last question is worth answering honestly. Whether a set stopped
          because the muscle failed, because you were out of gas, or because you
          chose to spend the effort elsewhere are three different things, and
          only the first says anything about the weight.
        </p>
      </Step>

      <Step icon={History} title="And then: history and insights">
        <p>
          <span className="text-content font-medium">History</span> is every
          session you have logged. <span className="text-content font-medium">Insights</span>{' '}
          is what they add up to — weekly sets per muscle, estimated strength per
          exercise, and where a lift has sat at the same weight long enough to
          be worth adding to.
        </p>
        <p>
          Insights only claims a trend when there is enough behind it. A dash
          rather than an arrow means not enough sessions yet, which is different
          from no change.
        </p>
      </Step>
    </div>

    <div className="mt-10 pt-6 border-t">
      <h3 className="text-base font-medium text-content mb-1 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-content-subtle" />
        One more thing
      </h3>
      <p className="text-sm text-content-muted">
        Templates can be exported, revised in an AI chat, and imported back —
        under Settings, Rebuild Templates with AI. Importing only ever adds, so
        nothing you have is overwritten.
      </p>
    </div>
  </div>
);

export default HowItWorks;
