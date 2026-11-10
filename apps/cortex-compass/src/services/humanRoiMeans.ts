import { csvParse } from 'd3';
import type { EvidenceImage, Roi } from '../types/data';
import { CANONICAL_ROIS, type CanonicalRoi } from '../types/session';
import { IMAGE_BASE_PATH } from '../utils/data';
import { publicPath } from '../utils/publicPath';

export const HUMAN_ROI_MEANS_CSV_PATH = publicPath('/data/murty185_human_roi_means.csv');
export const HUMAN_ROI_MEANS_MANIFEST_PATH = publicPath('/data/murty185_human_roi_means.json');

export type HumanRoiMeansTable = {
  imageNames: string[];
  values: Record<CanonicalRoi, number[]>;
};

function asCanonicalRoi(roi: Roi): CanonicalRoi | null {
  return (CANONICAL_ROIS as readonly string[]).includes(roi) ? roi as CanonicalRoi : null;
}

function parseHumanRoiMeansCsv(text: string): HumanRoiMeansTable {
  const rows = csvParse(text);
  if (rows.length !== 185) {
    throw new Error(`Murty human ROI means must contain 185 images, got ${rows.length}.`);
  }
  const imageNames: string[] = [];
  const values: Record<CanonicalRoi, number[]> = { ffa: [], ppa: [], eba: [] };
  rows.forEach((row, index) => {
    const imageName = String(row.image_name ?? '');
    const expected = `image_${String(index + 1).padStart(3, '0')}.png`;
    if (imageName !== expected) {
      throw new Error(`Murty human ROI means image order mismatch at ${index}: expected ${expected}.`);
    }
    imageNames.push(imageName);
    for (const roi of CANONICAL_ROIS) {
      const value = Number(row[roi]);
      if (!Number.isFinite(value)) {
        throw new Error(`Murty human ROI means missing finite ${roi.toUpperCase()} for ${imageName}.`);
      }
      values[roi].push(value);
    }
  });
  return { imageNames, values };
}

let cached: Promise<HumanRoiMeansTable> | null = null;

export function loadHumanRoiMeans(fetcher: typeof fetch = fetch): Promise<HumanRoiMeansTable> {
  if (!cached) {
    cached = fetcher(HUMAN_ROI_MEANS_CSV_PATH)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load Murty human ROI means (${response.status}).`);
        }
        return parseHumanRoiMeansCsv(await response.text());
      })
      .catch((error: unknown) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

/** Ranked measured ROI-mean images for one canonical ROI (rank 1 = highest). */
export function humanEvidenceImages(table: HumanRoiMeansTable, roi: Roi): EvidenceImage[] | null {
  const canonical = asCanonicalRoi(roi);
  if (!canonical) return null;
  const ranked = table.imageNames
    .map((imageName, index) => ({
      imageName,
      imageUrl: `${IMAGE_BASE_PATH}/${imageName}`,
      value: table.values[canonical][index],
      rank: 0,
      origin: 'reference' as const,
    }))
    .sort((left, right) => right.value - left.value || left.imageName.localeCompare(right.imageName))
    .map((image, index) => ({ ...image, rank: index + 1 }));
  return ranked;
}

export function resetHumanRoiMeansCacheForTests(): void {
  cached = null;
}
