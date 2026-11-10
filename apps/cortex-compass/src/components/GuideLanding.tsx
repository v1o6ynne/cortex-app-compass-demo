import { GUIDE_COPY, type CompassGuide } from '../types/guide';

type GuideLandingProps = {
  hasSession: boolean;
  onOpenGuide: (guide: Exclude<CompassGuide, 'home'>) => void;
};

export function GuideLanding({ hasSession, onOpenGuide }: GuideLandingProps) {
  return (
    <section className="guide-landing" aria-label="Cortex-Compass guides">
      <p className="guide-landing-intro">Choose a starting question.</p>
      <div className="guide-card-grid">
        <button type="button" className="guide-card" onClick={() => onOpenGuide('models')}>
          <span className="eyebrow">{GUIDE_COPY.models.code} · {GUIDE_COPY.models.eyebrow}</span>
          <h2>{GUIDE_COPY.models.title}</h2>
          <p>{GUIDE_COPY.models.description}</p>
        </button>
        <button type="button" className="guide-card" onClick={() => onOpenGuide('stimuli')}>
          <span className="eyebrow">{GUIDE_COPY.stimuli.code} · {GUIDE_COPY.stimuli.eyebrow}</span>
          <h2>{GUIDE_COPY.stimuli.title}</h2>
          <p>{GUIDE_COPY.stimuli.description}</p>
        </button>
      </div>
      {hasSession && (
        <p className="guide-landing-session">
          An upload comparison from the Lab is ready in{' '}
          <button type="button" className="guide-inline-link" onClick={() => onOpenGuide('stimuli')}>
            {GUIDE_COPY.stimuli.title}
          </button>
          .
        </p>
      )}
    </section>
  );
}
