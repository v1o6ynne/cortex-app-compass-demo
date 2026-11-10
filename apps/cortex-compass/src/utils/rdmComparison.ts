import type { CanonicalRoi } from '../types/session';
import type { BrainMapReferenceSet } from '../types/brainMap';

/** Match Core `rdm_from_predictions`: Euclidean distance / voxel count. */
export function normalizedEuclideanRdm(matrix: number[][]): number[][] {
  const n = matrix.length;
  if (n === 0) return [];
  const voxels = matrix[0]?.length ?? 0;
  if (voxels === 0) throw new Error('RDM requires at least one voxel.');
  for (const row of matrix) {
    if (row.length !== voxels) throw new Error('RDM rows must share a voxel width.');
  }

  const rdm = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let sumSquares = 0;
      const a = matrix[i];
      const b = matrix[j];
      for (let k = 0; k < voxels; k += 1) {
        const delta = a[k] - b[k];
        sumSquares += delta * delta;
      }
      const distance = Math.sqrt(sumSquares) / voxels;
      rdm[i][j] = distance;
      rdm[j][i] = distance;
    }
  }
  return rdm;
}

export function upperTriangle(rdm: number[][]): number[] {
  const values: number[] = [];
  for (let i = 0; i < rdm.length; i += 1) {
    for (let j = i + 1; j < rdm.length; j += 1) values.push(rdm[i][j]);
  }
  return values;
}

function pearsonCorrelation(aValues: number[], bValues: number[]): number | null {
  if (aValues.length !== bValues.length || aValues.length < 2) return null;
  const aMean = aValues.reduce((sum, value) => sum + value, 0) / aValues.length;
  const bMean = bValues.reduce((sum, value) => sum + value, 0) / bValues.length;
  let numerator = 0;
  let aSumSquares = 0;
  let bSumSquares = 0;
  for (let i = 0; i < aValues.length; i += 1) {
    const aCentered = aValues[i] - aMean;
    const bCentered = bValues[i] - bMean;
    numerator += aCentered * bCentered;
    aSumSquares += aCentered ** 2;
    bSumSquares += bCentered ** 2;
  }
  const denominator = Math.sqrt(aSumSquares * bSumSquares);
  if (denominator === 0) return null;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

/** Match Core `spearmanr`: ordinal ranks (0..n-1), then Pearson. */
export function spearmanCorrelation(aValues: number[], bValues: number[]): number | null {
  if (aValues.length !== bValues.length || aValues.length < 2) return null;

  function ranks(values: number[]): number[] {
    const order = values.map((value, index) => ({ value, index }))
      .sort((left, right) => left.value - right.value || left.index - right.index);
    const out = Array.from({ length: values.length }, () => 0);
    order.forEach((entry, rank) => { out[entry.index] = rank; });
    return out;
  }

  return pearsonCorrelation(ranks(aValues), ranks(bValues));
}

export type RdmPairDisagreement = {
  indexA: number;
  indexB: number;
  imageNameA: string;
  imageNameB: string;
  imageUrlA: string;
  imageUrlB: string;
  distanceA: number;
  distanceB: number;
  delta: number;
};

export type ModelRdmComparison = {
  roi: CanonicalRoi;
  imageNames: string[];
  imageUrls: string[];
  rdmA: number[][];
  rdmB: number[][];
  voxelCount: number;
  spearmanRho: number | null;
  maxDistance: number;
  disagreements: RdmPairDisagreement[];
};

export function roiMatrixFromReferences(
  references: BrainMapReferenceSet,
  roi: CanonicalRoi,
): { matrix: number[][]; imageNames: string[]; imageUrls: string[]; voxelCount: number } {
  const imageNames = references.stimuli.map((stimulus) => stimulus.imageName);
  const imageUrls = references.stimuli.map((stimulus) => stimulus.imageUrl);
  const matrix = references.stimuli.map((stimulus) => stimulus.roiResponses[roi]);
  const voxelCount = matrix[0]?.length ?? 0;
  if (matrix.length < 2 || voxelCount === 0) {
    throw new Error(`Need at least two images with ${roi.toUpperCase()} voxels.`);
  }
  return { matrix, imageNames, imageUrls, voxelCount };
}

export function buildModelRdmComparison(
  referencesA: BrainMapReferenceSet,
  referencesB: BrainMapReferenceSet,
  roi: CanonicalRoi,
  disagreementCount = 4,
): ModelRdmComparison {
  if (referencesA.stimuli.length !== referencesB.stimuli.length) {
    throw new Error('Compared models must share the same reference image count.');
  }
  for (let index = 0; index < referencesA.stimuli.length; index += 1) {
    if (referencesA.stimuli[index].imageName !== referencesB.stimuli[index].imageName) {
      throw new Error('Compared models must share the same reference image order.');
    }
  }

  const a = roiMatrixFromReferences(referencesA, roi);
  const b = roiMatrixFromReferences(referencesB, roi);
  if (a.voxelCount !== b.voxelCount) {
    throw new Error(`ROI voxel counts differ for ${roi.toUpperCase()}.`);
  }

  const rdmA = normalizedEuclideanRdm(a.matrix);
  const rdmB = normalizedEuclideanRdm(b.matrix);
  const spearmanRho = spearmanCorrelation(upperTriangle(rdmA), upperTriangle(rdmB));

  let maxDistance = 0;
  const disagreements: RdmPairDisagreement[] = [];
  for (let i = 0; i < rdmA.length; i += 1) {
    for (let j = i + 1; j < rdmA.length; j += 1) {
      maxDistance = Math.max(maxDistance, rdmA[i][j], rdmB[i][j]);
      const delta = rdmB[i][j] - rdmA[i][j];
      disagreements.push({
        indexA: i,
        indexB: j,
        imageNameA: a.imageNames[i],
        imageNameB: a.imageNames[j],
        imageUrlA: a.imageUrls[i],
        imageUrlB: a.imageUrls[j],
        distanceA: rdmA[i][j],
        distanceB: rdmB[i][j],
        delta,
      });
    }
  }

  disagreements.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)
    || left.imageNameA.localeCompare(right.imageNameA)
    || left.imageNameB.localeCompare(right.imageNameB));

  return {
    roi,
    imageNames: a.imageNames,
    imageUrls: a.imageUrls,
    rdmA,
    rdmB,
    voxelCount: a.voxelCount,
    spearmanRho,
    maxDistance,
    disagreements: disagreements.slice(0, disagreementCount),
  };
}
