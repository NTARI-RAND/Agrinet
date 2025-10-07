import React, { useMemo } from 'react';
import { useStore } from '../store';

const STAGES = [
  {
    id: 'seed',
    label: 'Seed',
    caption: 'Frame the question',
    threshold: 0,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21c3.866 0 7-3.582 7-8 0-4.418-3.134-8-7-8S5 8.582 5 13c0 4.418 3.134 8 7 8Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M12 19s-3-1.5-3-6c0-4.5 3-6 3-6s3 1.5 3 6c0 4.5-3 6-3 6Zm0-9.2v6.4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'sprout',
    label: 'Sprout',
    caption: 'Explore possibilities',
    threshold: 4,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 12c3.5 0 5.5-2 5.5-6-3.5 0-5.5 2-5.5 6Zm14 0c-3.5 0-5.5-2-5.5-6 3.5 0 5.5 2 5.5 6Z"
          fill="currentColor"
          opacity="0.16"
        />
        <path
          d="M12 20v-9m0 0c0-4.5 1.8-6.8 6-7m-6 7c0-4.5-1.8-6.8-6-7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'harvest',
    label: 'Harvest',
    caption: 'Summarise your plan',
    threshold: 9,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M8.5 14.5c1.2 1.2 2.8 1.8 4.5 1.5 1.7-.3 3.1-1.4 3.8-3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="m12 6.8.8 1.6 1.8.2-1.3 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.3-1.2 1.8-.2.8-1.6Z"
          fill="currentColor"
          opacity="0.2"
        />
      </svg>
    ),
  },
];

function easedProgress(messageCount) {
  if (messageCount <= 0) return 0;
  const normalised = Math.min(messageCount / 12, 1);
  return Math.pow(normalised, 0.68);
}

export default function FarmProgress() {
  const { state } = useStore();
  const messageCount = state.messages.length;

  const { activeStage, progressWidth } = useMemo(() => {
    const eased = easedProgress(messageCount);
    const width = `${Math.round(eased * 100)}%`;
    const current = STAGES.reduce((acc, stage) => {
      if (messageCount >= stage.threshold) return stage;
      return acc;
    }, STAGES[0]);
    return { activeStage: current, progressWidth: width };
  }, [messageCount]);

  return (
    <div className="progress-track" aria-live="polite" aria-label="Conversation growth stages">
      <span className="progress-meter" style={{ width: progressWidth }} />
      {STAGES.map((stage) => {
        const isActive = activeStage.id === stage.id;
        const isComplete = messageCount >= stage.threshold + 3;
        return (
          <div
            key={stage.id}
            className="progress-seed"
            data-active={isActive || undefined}
            data-complete={isComplete || undefined}
          >
            <div className="badge" aria-hidden="true" style={{ animationDelay: `${stage.threshold * 30}ms` }}>
              {stage.icon}
              <span className="progress-label">{stage.label}</span>
            </div>
            <span className="progress-caption">{stage.caption}</span>
          </div>
        );
      })}
    </div>
  );
}
