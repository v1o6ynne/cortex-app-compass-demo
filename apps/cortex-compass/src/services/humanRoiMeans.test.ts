import { describe, expect, it } from 'vitest';
import humanCsv from '../../public/data/murty185_human_roi_means.csv?raw';
import { buildSharedResponseComparison } from '../utils/responseComparison';
import { rankImagesByColumn } from '../utils/evidence';
import referenceCsv from '../../public/data/combined_image_means.csv?raw';
import { csvParse } from 'd3';
import { humanEvidenceImages, loadHumanRoiMeans, resetHumanRoiMeansCacheForTests } from './humanRoiMeans';

describe('Murty human ROI means artifact', () => {
  it('parses the reviewed 185-image p1–p4 average means', async () => {
    resetHumanRoiMeansCacheForTests();
    const fetcher = (async () => new Response(humanCsv, { status: 200 })) as unknown as typeof fetch;
    const table = await loadHumanRoiMeans(fetcher);
    expect(table.imageNames).toHaveLength(185);
    expect(table.imageNames[0]).toBe('image_001.png');
    expect(table.values.ffa[0]).toBeCloseTo(-0.5080014794290205, 12);
    expect(table.values.ppa[0]).toBeCloseTo(0.3009801491855695, 12);
    expect(table.values.eba[0]).toBeCloseTo(0.7553652501230158, 12);
  });

  it('builds human evidence ranks and correlates against CLIP RN50 PPA predictions', async () => {
    resetHumanRoiMeansCacheForTests();
    const fetcher = (async () => new Response(humanCsv, { status: 200 })) as unknown as typeof fetch;
    const table = await loadHumanRoiMeans(fetcher);
    const human = humanEvidenceImages(table, 'ppa');
    expect(human).not.toBeNull();
    expect(human![0].rank).toBe(1);

    const rows = csvParse(referenceCsv, (row) => ({ ...row, image_name: String(row.image_name ?? '') }));
    const model = rankImagesByColumn(rows, 'clip_rn50_ppa');
    const comparison = buildSharedResponseComparison(human!, model);
    expect(comparison.unavailableReason).toBeNull();
    expect(comparison.points).toHaveLength(185);
    expect(comparison.rankSpearman).not.toBeNull();
    expect(comparison.meanPearson).not.toBeNull();
    expect(humanEvidenceImages(table, 'Overall')).toBeNull();
  });
});
