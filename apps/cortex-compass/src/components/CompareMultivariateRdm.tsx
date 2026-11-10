import { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceImage, SelectedHeatmapCell } from '../types/data';
import { CANONICAL_ROIS, type CanonicalRoi } from '../types/session';
import { loadBrainMapReferences } from '../services/brainReferenceAssets';
import { buildModelRdmComparison, type ModelRdmComparison } from '../utils/rdmComparison';
import { comparisonModelLabel } from './CompareResponseScatter';

type Props = {
  cellA: SelectedHeatmapCell;
  cellB: SelectedHeatmapCell;
  onOpenImage: (image: EvidenceImage) => void;
};

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; comparison: ModelRdmComparison };

function asCanonicalRoi(roi: string): CanonicalRoi | null {
  return (CANONICAL_ROIS as readonly string[]).includes(roi) ? roi as CanonicalRoi : null;
}

function fmt(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

function RdmHeatmap({
  label,
  rdm,
  maxDistance,
}: {
  label: string;
  rdm: number[][];
  maxDistance: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rdm.length === 0) return;
    const size = rdm.length;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(size, size);
    const scale = maxDistance > 0 ? 1 / maxDistance : 0;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const t = Math.max(0, Math.min(1, rdm[row][col] * scale));
        // Light → dark teal: low to high dissimilarity.
        const offset = (row * size + col) * 4;
        image.data[offset] = Math.round(245 - t * 170);
        image.data[offset + 1] = Math.round(248 - t * 110);
        image.data[offset + 2] = Math.round(250 - t * 70);
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, [maxDistance, rdm]);

  return (
    <figure className="compare-rdm-figure">
      <figcaption>{label}</figcaption>
      <canvas ref={canvasRef} className="compare-rdm-canvas" aria-label={`${label} representational dissimilarity matrix`} />
    </figure>
  );
}

export function CompareMultivariateRdm({ cellA, cellB, onOpenImage }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const roiA = asCanonicalRoi(cellA.roi);
  const roiB = asCanonicalRoi(cellB.roi);
  const aLabel = comparisonModelLabel(cellA.model);
  const bLabel = comparisonModelLabel(cellB.model);

  const blockedReason = useMemo(() => {
    if (!roiA || !roiB) return 'Multivariate RDM comparison needs FFA, PPA, or EBA cells.';
    if (roiA !== roiB) return 'Select the same ROI for both models to compare RDMs.';
    return null;
  }, [roiA, roiB]);

  useEffect(() => {
    if (blockedReason || !roiA) {
      setState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    Promise.all([
      loadBrainMapReferences(cellA.model, fetch, controller.signal),
      loadBrainMapReferences(cellB.model, fetch, controller.signal),
    ])
      .then(([referencesA, referencesB]) => {
        const comparison = buildModelRdmComparison(referencesA, referencesB, roiA);
        setState({ status: 'ready', comparison });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Subject 1 voxel predictions could not be loaded.';
        setState({ status: 'error', message });
      });

    return () => controller.abort();
  }, [blockedReason, cellA.model, cellB.model, roiA]);

  if (blockedReason) {
    return <p className="compare-empty">{blockedReason}</p>;
  }

  if (state.status === 'error') {
    return <p className="compare-empty" role="status">{state.message}</p>;
  }

  if (state.status !== 'ready') {
    return <p className="compare-empty" role="status">Loading Subject 1 voxel predictions…</p>;
  }

  const comparison = state.comparison;
  const sharedMax = comparison.maxDistance;

  return (
    <section className="compare-rdm-section" aria-label="Multivariate RDM comparison">
      <div className="compare-response-intro">
        <div>
          <h3>Representational dissimilarity</h3>
          <p className="compare-analysis-note">
            Euclidean RDM from Subject 1 {comparison.roi.toUpperCase()} voxel patterns
            ({comparison.voxelCount} voxels · {comparison.imageNames.length} Murty-185 images),
            matching Core multivariate geometry. Not the scoreboard multi-subject multivariate score.
          </p>
        </div>
        <div className="compare-metric-badges" aria-label="Multivariate summary metrics">
          <span title="Spearman correlation between upper triangles of the two RDMs">
            RDM Spearman ρ: <strong>{fmt(comparison.spearmanRho)}</strong>
          </span>
        </div>
      </div>

      <div className="compare-rdm-grid">
        <RdmHeatmap label={aLabel} rdm={comparison.rdmA} maxDistance={sharedMax} />
        <RdmHeatmap label={bLabel} rdm={comparison.rdmB} maxDistance={sharedMax} />
      </div>
      <p className="compare-rdm-legend">Shared color scale: light = similar image pair, dark = dissimilar. Same stimulus order in both matrices.</p>

      <div className="compare-rdm-disagreements" aria-label="Largest RDM disagreements">
        <h4>Largest pairwise disagreements</h4>
        <div className="compare-rdm-disagreement-grid">
          {comparison.disagreements.map((pair) => (
            <article key={`${pair.imageNameA}:${pair.imageNameB}`} className="compare-rdm-disagreement">
              <div className="compare-rdm-pair">
                <button
                  type="button"
                  onClick={() => onOpenImage({
                    imageName: pair.imageNameA,
                    imageUrl: pair.imageUrlA,
                    value: pair.distanceA,
                    rank: pair.indexA + 1,
                    valueLabel: `${aLabel}↔${bLabel} pair distance`,
                  })}
                >
                  <img src={pair.imageUrlA} alt={pair.imageNameA} />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenImage({
                    imageName: pair.imageNameB,
                    imageUrl: pair.imageUrlB,
                    value: pair.distanceB,
                    rank: pair.indexB + 1,
                    valueLabel: `${aLabel}↔${bLabel} pair distance`,
                  })}
                >
                  <img src={pair.imageUrlB} alt={pair.imageNameB} />
                </button>
              </div>
              <strong>{pair.imageNameA.replace(/\.png$/i, '')} · {pair.imageNameB.replace(/\.png$/i, '')}</strong>
              <span>{aLabel} d={pair.distanceA.toFixed(4)}</span>
              <span>{bLabel} d={pair.distanceB.toFixed(4)}</span>
              <span>Δ {pair.delta >= 0 ? '+' : ''}{pair.delta.toFixed(4)}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
