export type CompassGuide = 'home' | 'models' | 'stimuli';

export const GUIDE_COPY = {
  models: {
    code: 'DG1',
    title: 'Which model should I use?',
    eyebrow: 'Guide model selection',
    description:
      'Understand how competing models differ beyond overall accuracy and choose a model suited to your scientific question.',
  },
  stimuli: {
    code: 'DG2',
    title: 'What stimuli should I investigate next?',
    eyebrow: 'Guide iterative stimulus design',
    description:
      'Explore fine-grained response patterns, identify informative stimulus contrasts, and refine your experimental stimulus set.',
  },
} as const;

export function readInitialGuide(search = typeof window === 'undefined' ? '' : window.location.search): CompassGuide {
  const guide = new URLSearchParams(search).get('guide');
  return guide === 'models' || guide === 'stimuli' ? guide : 'home';
}
