import { useMemo, useState } from 'react';
import type { EvidenceImage, EvidenceView, SelectedHeatmapCell } from '../types/data';
import { buildSharedResponseComparison } from '../utils/responseComparison';
import { CompareMultivariateRdm } from './CompareMultivariateRdm';
import { CompareResponseScatter } from './CompareResponseScatter';

type Props = {
  cellA: SelectedHeatmapCell;
  cellB: SelectedHeatmapCell;
  evidenceA: EvidenceView | null;
  evidenceB: EvidenceView | null;
  onOpenImage: (image: EvidenceImage) => void;
};

type AnalysisView = 'univariate' | 'multivariate';

function fmt(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

export function CompareResponseTools({ cellA, cellB, evidenceA, evidenceB, onOpenImage }: Props) {
  const [activeView, setActiveView] = useState<AnalysisView>('univariate');
  const [multivariateVisited, setMultivariateVisited] = useState(false);
  const comparison = useMemo(
    () => buildSharedResponseComparison(evidenceA?.images ?? [], evidenceB?.images ?? []),
    [evidenceA, evidenceB],
  );

  return (
    <section className="compare-response-tools" aria-label="Linked image comparison">
      <div className="compare-linked-tabs" role="tablist" aria-label="Response analysis">
        <button
          type="button"
          role="tab"
          id="compare-univariate-tab"
          aria-selected={activeView === 'univariate'}
          aria-controls="compare-analysis-panel"
          onClick={() => setActiveView('univariate')}
        >
          Univariate
        </button>
        <button
          type="button"
          role="tab"
          id="compare-multivariate-tab"
          aria-selected={activeView === 'multivariate'}
          aria-controls="compare-analysis-panel"
          onClick={() => {
            setMultivariateVisited(true);
            setActiveView('multivariate');
          }}
        >
          Multivariate
        </button>
      </div>

      <div
        id="compare-analysis-panel"
        role="tabpanel"
        aria-labelledby={activeView === 'univariate' ? 'compare-univariate-tab' : 'compare-multivariate-tab'}
      >
        <div hidden={activeView !== 'univariate'}>
          {comparison.unavailableReason ? (
            <p className="compare-empty">{comparison.unavailableReason}</p>
          ) : (
            <>
              <div className="compare-analysis-header">
                <div>
                  <h3 className="compare-analysis-title">Univariate · ROI mean responses</h3>
                  <p className="compare-analysis-note">
                    Rank–rank scatter compares how the two models order the same images by ROI-mean
                    prediction (voxels collapsed). The list highlights the largest absolute rank shifts.
                  </p>
                </div>
                <div className="compare-metric-badges" aria-label="Univariate summary metrics">
                  <span title="Pearson correlation of ROI-mean responses across shared images">
                    Mean Pearson r: <strong>{fmt(comparison.meanPearson)}</strong>
                  </span>
                  <span title="Spearman correlation of the models' response ranks">
                    Rank Spearman ρ: <strong>{fmt(comparison.rankSpearman)}</strong>
                  </span>
                </div>
              </div>
              <CompareResponseScatter
                points={comparison.points}
                cellA={cellA}
                cellB={cellB}
                onOpenImage={onOpenImage}
              />
            </>
          )}
        </div>

        {multivariateVisited && (
          <div hidden={activeView !== 'multivariate'}>
            <CompareMultivariateRdm cellA={cellA} cellB={cellB} onOpenImage={onOpenImage} />
          </div>
        )}
      </div>
    </section>
  );
}
