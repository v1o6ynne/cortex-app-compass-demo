import { useEffect, useMemo, useState } from 'react';
import type { EvidenceImage, EvidenceView, SelectedHeatmapCell } from '../types/data';
import { humanEvidenceImages, loadHumanRoiMeans, type HumanRoiMeansTable } from '../services/humanRoiMeans';
import { buildSharedResponseComparison, type SharedResponseComparison } from '../utils/responseComparison';
import { CompareMultivariateRdm } from './CompareMultivariateRdm';
import { CompareResponseScatter, comparisonModelLabel } from './CompareResponseScatter';

type Props = {
  cellA: SelectedHeatmapCell;
  cellB: SelectedHeatmapCell;
  evidenceA: EvidenceView | null;
  evidenceB: EvidenceView | null;
  onOpenImage: (image: EvidenceImage) => void;
};

type AnalysisView = 'univariate' | 'multivariate';

type HumanLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; table: HumanRoiMeansTable };

function fmt(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

function humanModelComparison(
  table: HumanRoiMeansTable | null,
  cell: SelectedHeatmapCell,
  evidence: EvidenceView | null,
): { comparison: SharedResponseComparison; reason: string | null } {
  if (!table) {
    return {
      comparison: buildSharedResponseComparison([], []),
      reason: 'Loading Murty human ROI means…',
    };
  }
  const human = humanEvidenceImages(table, cell.roi);
  if (!human) {
    return {
      comparison: buildSharedResponseComparison([], []),
      reason: 'Human–model rank comparison needs an FFA, PPA, or EBA cell.',
    };
  }
  if (!evidence) {
    return {
      comparison: buildSharedResponseComparison([], []),
      reason: 'Model ROI-mean predictions are unavailable for this cell.',
    };
  }
  const comparison = buildSharedResponseComparison(human, evidence.images);
  return { comparison, reason: comparison.unavailableReason };
}

export function CompareResponseTools({ cellA, cellB, evidenceA, evidenceB, onOpenImage }: Props) {
  const [activeView, setActiveView] = useState<AnalysisView>('univariate');
  const [multivariateVisited, setMultivariateVisited] = useState(false);
  const [humanState, setHumanState] = useState<HumanLoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setHumanState({ status: 'loading' });
    loadHumanRoiMeans()
      .then((table) => {
        if (!controller.signal.aborted) setHumanState({ status: 'ready', table });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setHumanState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Murty human ROI means could not be loaded.',
        });
      });
    return () => controller.abort();
  }, []);

  const humanTable = humanState.status === 'ready' ? humanState.table : null;
  const pairA = useMemo(
    () => humanModelComparison(humanTable, cellA, evidenceA),
    [cellA, evidenceA, humanTable],
  );
  const pairB = useMemo(
    () => humanModelComparison(humanTable, cellB, evidenceB),
    [cellB, evidenceB, humanTable],
  );

  const aLabel = comparisonModelLabel(cellA.model);
  const bLabel = comparisonModelLabel(cellB.model);

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
          <div className="compare-analysis-header">
            <div>
              <h3 className="compare-analysis-title">Univariate · Murty human vs each model</h3>
              <p className="compare-analysis-note">
                Two slopegraphs compare Murty-185 human ranks with each model&apos;s predicted ranks
                (1 at top). Connecting lines show rank shifts. Alignment is the official scoreboard
                univariate score for that ROI.
              </p>
            </div>
            <div className="compare-metric-badges" aria-label="Human–model summary metrics">
              <span title={`Scoreboard univariate Alignment for ${aLabel} on this ROI`}>
                {aLabel} Alignment: <strong>{fmt(cellA.score)}</strong>
              </span>
              <span title={`Scoreboard univariate Alignment for ${bLabel} on this ROI`}>
                {bLabel} Alignment: <strong>{fmt(cellB.score)}</strong>
              </span>
            </div>
          </div>

          {humanState.status === 'loading' && (
            <p className="compare-empty" role="status">Loading Murty human ROI means…</p>
          )}
          {humanState.status === 'error' && (
            <p className="compare-empty" role="status">{humanState.message}</p>
          )}

          {humanState.status === 'ready' && (
            <div className="compare-human-model-grid">
              <HumanModelPanel
                cell={cellA}
                label={aLabel}
                pair={pairA}
                onOpenImage={onOpenImage}
              />
              <HumanModelPanel
                cell={cellB}
                label={bLabel}
                pair={pairB}
                onOpenImage={onOpenImage}
              />
            </div>
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

function HumanModelPanel({
  cell,
  label,
  pair,
  onOpenImage,
}: {
  cell: SelectedHeatmapCell;
  label: string;
  pair: { comparison: SharedResponseComparison; reason: string | null };
  onOpenImage: (image: EvidenceImage) => void;
}) {
  if (pair.reason) {
    return (
      <div className="compare-human-model-panel">
        <h4 className="compare-human-model-heading">Murty human vs {label}</h4>
        <p className="compare-empty">{pair.reason}</p>
      </div>
    );
  }

  return (
    <div className="compare-human-model-panel">
      <div className="compare-metric-badges compare-human-model-metrics" aria-label={`${label} versus human metrics`}>
        <span title="Official scoreboard univariate Alignment (NSD→Murty Pearson), not a re-average of human means in this panel">
          Alignment: <strong>{fmt(cell.score)}</strong>
        </span>
        <span title="Spearman correlation between Murty human ranks and this model's predicted ranks">
          Rank ρ: <strong>{fmt(pair.comparison.rankSpearman)}</strong>
        </span>
      </div>
      <CompareResponseScatter
        points={pair.comparison.points}
        xLabel="Murty human"
        yLabel={label}
        roiLabel={String(cell.roi).toUpperCase()}
        onOpenImage={onOpenImage}
        compact
      />
    </div>
  );
}
