import { describe, expect, it } from 'vitest';
import type { BrainMapReferenceSet } from '../types/brainMap';
import {
  buildModelRdmComparison,
  normalizedEuclideanRdm,
  spearmanCorrelation,
  upperTriangle,
} from './rdmComparison';

describe('normalized Euclidean RDM', () => {
  it('matches Core semantics: Euclidean distance divided by voxel count', () => {
    const matrix = [
      [0, 0, 0],
      [3, 0, 0],
      [0, 4, 0],
    ];
    const rdm = normalizedEuclideanRdm(matrix);
    expect(rdm[0][0]).toBe(0);
    expect(rdm[1][0]).toBeCloseTo(1, 12); // 3 / 3
    expect(rdm[0][1]).toBeCloseTo(1, 12);
    expect(rdm[2][0]).toBeCloseTo(4 / 3, 12);
    expect(rdm[1][2]).toBeCloseTo(5 / 3, 12); // hypot(3,4) / 3
  });

  it('returns an empty matrix for no images', () => {
    expect(normalizedEuclideanRdm([])).toEqual([]);
  });
});

describe('Spearman correlation of RDMs', () => {
  it('is 1 for identical upper triangles and -1 for reversed ranks', () => {
    const values = [0.1, 0.4, 0.2, 0.9];
    expect(spearmanCorrelation(values, values)).toBeCloseTo(1, 12);
    expect(spearmanCorrelation(values, [...values].reverse())).toBeCloseTo(-1, 12);
  });

  it('returns null without enough values', () => {
    expect(spearmanCorrelation([1], [2])).toBeNull();
  });
});

describe('model–model RDM comparison', () => {
  function refs(model: string, responses: number[][]): BrainMapReferenceSet {
    return {
      model,
      referenceVersion: 'test',
      responseSpace: 'nsd_1000_subject1_floc_t7_v1',
      stimuli: responses.map((ffa, index) => ({
        imageName: `image_${String(index + 1).padStart(3, '0')}.png`,
        imageUrl: `/images/image_${String(index + 1).padStart(3, '0')}.png`,
        roiResponses: {
          ffa,
          ppa: ffa,
          eba: ffa,
        },
      })),
    };
  }

  it('reports perfect RDM agreement for identical ROI patterns', () => {
    const patterns = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
    ];
    const comparison = buildModelRdmComparison(refs('a', patterns), refs('b', patterns), 'ffa', 2);
    expect(comparison.voxelCount).toBe(3);
    expect(comparison.spearmanRho).toBeCloseTo(1, 12);
    expect(upperTriangle(comparison.rdmA)).toEqual(upperTriangle(comparison.rdmB));
    expect(comparison.disagreements.every((pair) => pair.delta === 0)).toBe(true);
  });

  it('surfaces the largest absolute RDM deltas', () => {
    const a = [
      [0, 0],
      [4, 0],
      [0, 1],
      [1, 1],
    ];
    const b = [
      [0, 0],
      [1, 0],
      [0, 4],
      [1, 1],
    ];
    const comparison = buildModelRdmComparison(refs('a', a), refs('b', b), 'ppa', 1);
    expect(comparison.spearmanRho).not.toBeNull();
    expect(comparison.disagreements).toHaveLength(1);
    expect(Math.abs(comparison.disagreements[0].delta)).toBeGreaterThan(0);
    expect(comparison.disagreements[0]).toMatchObject({
      imageNameA: 'image_001.png',
      imageNameB: 'image_002.png',
    });
  });
});
