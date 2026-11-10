import { describe, expect, it } from 'vitest';
import { csvParse } from 'd3';
import referenceCsv from '../../public/data/combined_image_means.csv?raw';
import type { EvidenceImage } from '../types/data';
import { rankImagesByColumn } from './evidence';
import {
  buildSharedResponseComparison,
  rankAxisDomain,
  topRankDisagreements,
} from './responseComparison';

function image(id: number, value: number, rank = id, origin?: 'reference' | 'uploaded'): EvidenceImage {
  const imageName = `image_${String(id).padStart(3, '0')}.png`;
  return { imageName, imageUrl: `/images/${imageName}`, value, rank, origin };
}

describe('shared standardized predicted responses', () => {
  it('joins by image ID, uses only the shared population, and preserves existing ranks', () => {
    const result = buildSharedResponseComparison(
      [image(9, 100), image(1, 0, 19), image(2, 2, 12), image(3, 4, 4)],
      [image(3, 0, 27), image(8, 1000), image(1, 4, 8), image(2, 2, 14)],
    );
    expect(result.unavailableReason).toBeNull();
    expect(result.points.map(point => point.imageId)).toEqual(['image_001', 'image_002', 'image_003']);
    expect(result.meanA).toBe(2);
    expect(result.meanB).toBe(2);
    expect(result.sdA).toBeCloseTo(Math.sqrt(8 / 3), 14);
    expect(result.sdB).toBeCloseTo(Math.sqrt(8 / 3), 14);
    expect(result.points[0]).toMatchObject({ rankA: 19, rankB: 8, rankDelta: -11, absRankDelta: 11 });
    expect(result.points[0].zA).toBeCloseTo(-Math.sqrt(1.5), 14);
    expect(result.points[0].zB).toBeCloseTo(Math.sqrt(1.5), 14);
  });

  it('excludes uploads and non-finite predictions without matching them to references', () => {
    const result = buildSharedResponseComparison(
      [image(1, 0), image(2, 1), image(3, NaN), image(1, 100, 1, 'uploaded')],
      [image(1, 1), image(2, 0), image(3, 3)],
    );
    expect(result.unavailableReason).toBeNull();
    expect(result.points).toHaveLength(2);
    expect(result.meanA).toBe(.5);
    expect(result.meanB).toBe(.5);
  });

  it('fails closed for duplicate IDs, insufficient matches, or constant responses', () => {
    expect(buildSharedResponseComparison([image(1, 0), image(1, 1)], [image(1, 2), image(2, 3)]).unavailableReason)
      .toContain('duplicate');
    expect(buildSharedResponseComparison([image(1, 0)], [image(1, 2)]).points).toEqual([]);
    const constant = buildSharedResponseComparison([image(1, 1), image(2, 1)], [image(1, 2), image(2, 3)]);
    expect(constant.points).toEqual([]);
    expect(constant.sdA).toBe(0);
    expect(constant.unavailableReason).toContain('variation');
  });

  it('handles very small nonzero variation and leaves identical ranks unhighlighted', () => {
    const images = [image(1, 1e-200), image(2, 2e-200), image(3, 3e-200)];
    const result = buildSharedResponseComparison(images, images);
    expect(result.unavailableReason).toBeNull();
    expect(result.sdA).toBeGreaterThan(0);
    expect(result.points.every(point => point.rankDelta === 0 && point.rankLead === null)).toBe(true);
    expect(topRankDisagreements(result.points)).toEqual([]);
  });

  it('highlights the largest absolute rank disagreements and breaks ties by filename', () => {
    const a = [
      image(1, 6, 1), image(2, 5, 2), image(3, 4, 3), image(4, 3, 4),
      image(5, 2, 5), image(6, 1, 6),
    ];
    const b = [
      image(1, 1, 6), image(2, 2, 5), image(3, 3, 4), image(4, 4, 3),
      image(5, 5, 2), image(6, 6, 1),
    ];
    const result = buildSharedResponseComparison(a, b);
    const top = topRankDisagreements(result.points, 4).map((point) => point.imageId);
    expect(top).toEqual(['image_001', 'image_006', 'image_002', 'image_005']);
    expect(result.points.find((point) => point.imageId === 'image_001')?.rankLead).toBe('a');
    expect(result.points.find((point) => point.imageId === 'image_006')?.rankLead).toBe('b');
    const domain = rankAxisDomain(result.points);
    expect(domain[0]).toBeLessThan(1);
    expect(domain[1]).toBeGreaterThan(6);
    expect(rankAxisDomain([])).toEqual([1, 2]);
  });

  it('matches the independently audited 185-image RN50/ViT-B32 PPA predictions', () => {
    const rows = csvParse(referenceCsv, row => ({ ...row, image_name: String(row.image_name ?? '') }));
    const result = buildSharedResponseComparison(
      rankImagesByColumn(rows, 'clip_rn50_ppa'), rankImagesByColumn(rows, 'clip_vit_b32_ppa'),
    );
    expect(result.unavailableReason).toBeNull();
    expect(result.points).toHaveLength(185);
    expect(result.meanPearson).not.toBeNull();
    expect(result.rankSpearman).not.toBeNull();
    expect(result.meanA).toBeCloseTo(-.2432765681196501, 14);
    expect(result.meanB).toBeCloseTo(-.2662515031030083, 14);
    expect(result.sdA).toBeCloseTo(.4921282716270678, 14);
    expect(result.sdB).toBeCloseTo(.5455536348452827, 14);
    const ankle = result.points.find(point => point.imageId === 'image_101')!;
    const infant = result.points.find(point => point.imageId === 'image_026')!;
    expect(ankle).toMatchObject({ rankA: 105, rankB: 175, rankDelta: 70, absRankDelta: 70 });
    expect(ankle.zA).toBeCloseTo(-.343581337149067, 13);
    expect(ankle.zB).toBeCloseTo(-1.311291405696829, 13);
    expect(ankle.gap).toBeCloseTo(-.967710068547762, 13);
    expect(infant).toMatchObject({ rankA: 167, rankB: 116, rankDelta: -51 });
    expect(infant.gap).toBeCloseTo(.7668051754729253, 13);
    const top = topRankDisagreements(result.points, 8);
    expect(top).toHaveLength(8);
    expect(top[0].absRankDelta).toBeGreaterThanOrEqual(top[7].absRankDelta);
    expect(top.every((point) => point.rankLead === 'a' || point.rankLead === 'b')).toBe(true);
    const domain = rankAxisDomain(result.points);
    expect(result.points.every(point => point.rankA > domain[0] && point.rankA < domain[1]
      && point.rankB > domain[0] && point.rankB < domain[1])).toBe(true);
  });
});
