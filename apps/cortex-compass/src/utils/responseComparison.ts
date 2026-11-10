import type { EvidenceImage } from '../types/data';

export type SharedResponsePoint = {
  imageId: string;
  imageName: string;
  imageUrl: string;
  meanA: number;
  meanB: number;
  rankA: number;
  rankB: number;
  zA: number;
  zB: number;
  /** Standardized response in model B minus model A. */
  gap: number;
  /** The two largest gaps in each signed direction. */
  gapDirection: 'a' | 'b' | null;
};

export type SharedResponseComparison = {
  points: SharedResponsePoint[];
  meanA: number | null;
  meanB: number | null;
  sdA: number | null;
  sdB: number | null;
  /** Pearson r between the two models' ROI-mean responses on shared images. */
  meanPearson: number | null;
  /** Spearman ρ between the two models' existing response ranks. */
  rankSpearman: number | null;
  unavailableReason: string | null;
};

function compensatedSum(values: number[]): number {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    const corrected = value - correction;
    const next = sum + corrected;
    correction = (next - sum) - corrected;
    sum = next;
  }
  return sum;
}

/** Population moments over precisely the shared references, not the full roster. */
function populationMoments(values: number[]): { mean: number; sd: number } {
  if (values.every(value => value === values[0])) return { mean: values[0], sd: 0 };
  const mean = compensatedSum(values.map(value => value / values.length));
  const deviations = values.map(value => value - mean);
  const scale = Math.max(...deviations.map(Math.abs));
  // Scaling preserves genuinely small variances without squaring them to zero.
  const variance = scale === 0 ? 0 : compensatedSum(deviations.map(value => (value / scale) ** 2)) / values.length;
  return { mean, sd: scale * Math.sqrt(variance) };
}

function referenceIndex(images: EvidenceImage[]): Map<string, EvidenceImage> | null {
  const index = new Map<string, EvidenceImage>();
  for (const image of images) {
    if (image.origin === 'uploaded' || !image.imageName || !Number.isFinite(image.value)
      || !Number.isFinite(image.rank) || image.rank < 1) continue;
    if (index.has(image.imageName)) return null;
    index.set(image.imageName, image);
  }
  return index;
}

export function buildSharedResponseComparison(
  aImages: EvidenceImage[],
  bImages: EvidenceImage[],
): SharedResponseComparison {
  const unavailable = (unavailableReason: string): SharedResponseComparison => ({
    points: [], meanA: null, meanB: null, sdA: null, sdB: null,
    meanPearson: null, rankSpearman: null, unavailableReason,
  });
  const aByImage = referenceIndex(aImages);
  const bByImage = referenceIndex(bImages);
  if (!aByImage || !bByImage) {
    return unavailable('Shared responses are unavailable because a model has duplicate reference image IDs.');
  }
  const sharedNames = Array.from(aByImage.keys()).filter(name => bByImage.has(name))
    .sort((a, b) => a.localeCompare(b));
  if (sharedNames.length < 2) {
    return unavailable('At least two shared reference images with finite predictions are needed.');
  }
  const a = populationMoments(sharedNames.map(name => aByImage.get(name)!.value));
  const b = populationMoments(sharedNames.map(name => bByImage.get(name)!.value));
  if (![a.mean, a.sd, b.mean, b.sd].every(Number.isFinite) || a.sd === 0 || b.sd === 0) {
    return {
      points: [], meanA: Number.isFinite(a.mean) ? a.mean : null,
      meanB: Number.isFinite(b.mean) ? b.mean : null,
      sdA: Number.isFinite(a.sd) ? a.sd : null, sdB: Number.isFinite(b.sd) ? b.sd : null,
      meanPearson: null, rankSpearman: null,
      unavailableReason: 'Standardized responses are unavailable because a model has no finite variation across the shared references.',
    };
  }
  const points: SharedResponsePoint[] = sharedNames.map(imageName => {
    const imageA = aByImage.get(imageName)!;
    const imageB = bByImage.get(imageName)!;
    const zA = (imageA.value - a.mean) / a.sd;
    const zB = (imageB.value - b.mean) / b.sd;
    return {
      imageId: imageName.replace(/\.png$/i, ''), imageName, imageUrl: imageA.imageUrl,
      meanA: imageA.value, meanB: imageB.value, rankA: imageA.rank, rankB: imageB.rank,
      zA, zB, gap: zB - zA, gapDirection: null,
    };
  });
  const positive = points.filter(point => point.gap > 0)
    .sort((aPoint, bPoint) => bPoint.gap - aPoint.gap || aPoint.imageName.localeCompare(bPoint.imageName));
  const negative = points.filter(point => point.gap < 0)
    .sort((aPoint, bPoint) => aPoint.gap - bPoint.gap || aPoint.imageName.localeCompare(bPoint.imageName));
  for (const point of positive.slice(0, 2)) point.gapDirection = 'b';
  for (const point of negative.slice(0, 2)) point.gapDirection = 'a';
  return {
    points,
    meanA: a.mean,
    meanB: b.mean,
    sdA: a.sd,
    sdB: b.sd,
    meanPearson: pearsonOfPairs(points.map((point) => point.meanA), points.map((point) => point.meanB)),
    rankSpearman: pearsonOfPairs(points.map((point) => point.rankA), points.map((point) => point.rankB)),
    unavailableReason: null,
  };
}

function pearsonOfPairs(aValues: number[], bValues: number[]): number | null {
  if (aValues.length !== bValues.length || aValues.length < 2) return null;
  const aMean = compensatedSum(aValues.map((value) => value / aValues.length));
  const bMean = compensatedSum(bValues.map((value) => value / bValues.length));
  let numerator = 0;
  let aSumSquares = 0;
  let bSumSquares = 0;
  for (let index = 0; index < aValues.length; index += 1) {
    const aCentered = aValues[index] - aMean;
    const bCentered = bValues[index] - bMean;
    numerator += aCentered * bCentered;
    aSumSquares += aCentered ** 2;
    bSumSquares += bCentered ** 2;
  }
  const denominator = Math.sqrt(aSumSquares * bSumSquares);
  if (denominator === 0) return null;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

/** Use this same domain for both axes; one standardized unit has equal length. */
export function responseAxisDomain(points: SharedResponsePoint[]): [number, number] {
  if (points.length === 0) return [-1, 1];
  const values = points.flatMap(point => [point.zA, point.zB]).filter(Number.isFinite);
  if (values.length === 0) return [-1, 1];
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const padding = Math.max((max - min) * 0.08, 0.1);
  return [min - padding, max + padding];
}
