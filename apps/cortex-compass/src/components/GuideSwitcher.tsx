import { GUIDE_COPY, type CompassGuide } from '../types/guide';

type GuideSwitcherProps = {
  guide: Exclude<CompassGuide, 'home'>;
  onOpenGuide: (guide: CompassGuide) => void;
};

export function GuideSwitcher({ guide, onOpenGuide }: GuideSwitcherProps) {
  const other = guide === 'models' ? 'stimuli' : 'models';
  return (
    <nav className="guide-switcher" aria-label="Guide navigation">
      <button type="button" className="guide-switcher-home" onClick={() => onOpenGuide('home')}>
        All guides
      </button>
      <span className="guide-switcher-current" aria-current="page">
        {GUIDE_COPY[guide].code} · {GUIDE_COPY[guide].title}
      </span>
      <button type="button" className="guide-switcher-other" onClick={() => onOpenGuide(other)}>
        {GUIDE_COPY[other].title}
      </button>
    </nav>
  );
}
