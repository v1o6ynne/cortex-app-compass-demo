import { CompareDrawer } from './CompareDrawer';
import { ControlsBar } from './ControlsBar';
import { DetailsPanel } from './DetailsPanel';
import { GuideLanding } from './GuideLanding';
import { GuideSwitcher } from './GuideSwitcher';
import { Heatmap } from './Heatmap';
import { HelpBox } from './HelpBox';
import { SessionBanner } from './SessionBanner';
import { StimulusPicker } from './StimulusPicker';
import type {
  AggregateHeatmapCell,
  ClusteringData,
  ModelRoiColumn,
  RankingSystem,
  Roi,
  SelectedHeatmapCell,
  SortDirection,
  WideCsvRow,
} from '../types/data';
import type { CompassGuide } from '../types/guide';
import type { CortexComparisonSession } from '../types/session';

type VisualizationViewProps = {
  guide: CompassGuide;
  rows: WideCsvRow[];
  clustering: ClusteringData;
  modelRoiColumns: ModelRoiColumn[];
  heatmapRois: Roi[];
  heatmapCells: AggregateHeatmapCell[];
  allHeatmapCells: AggregateHeatmapCell[];
  allModels: string[];
  visibleModels: string[];
  rankingSystem: RankingSystem;
  selectedRankingRoi: Roi;
  sortDirection: SortDirection;
  modelSearch: string;
  showScoreLabels: boolean;
  selectedCell: SelectedHeatmapCell | null;
  compareMode: boolean;
  compareCells: SelectedHeatmapCell[];
  comparableCellIds: Set<string>;
  session: CortexComparisonSession | null;
  focusedStimulusId: string | null;
  sessionCellIds: Set<string>;
  onOpenGuide: (guide: CompassGuide) => void;
  onRankingSystemChange: (rankingSystem: RankingSystem) => void;
  onSelectedRankingRoiChange: (roi: Roi) => void;
  onSortDirectionToggle: () => void;
  onModelSearchChange: (searchTerm: string) => void;
  onShowScoreLabelsChange: (showScoreLabels: boolean) => void;
  onResetControls: () => void;
  onSelectCell: (cell: SelectedHeatmapCell) => void;
  onCompareModeChange: (enabled: boolean) => void;
  onFocusStimulus: (stimulusId: string) => void;
  onSelectSessionModel: (model: string) => void;
};

export function VisualizationView({
  guide,
  rows,
  clustering,
  modelRoiColumns,
  heatmapRois,
  heatmapCells,
  allHeatmapCells,
  allModels,
  visibleModels,
  rankingSystem,
  selectedRankingRoi,
  sortDirection,
  modelSearch,
  showScoreLabels,
  selectedCell,
  compareMode,
  compareCells,
  comparableCellIds,
  session,
  focusedStimulusId,
  sessionCellIds,
  onOpenGuide,
  onRankingSystemChange,
  onSelectedRankingRoiChange,
  onSortDirectionToggle,
  onModelSearchChange,
  onShowScoreLabelsChange,
  onResetControls,
  onSelectCell,
  onCompareModeChange,
  onFocusStimulus,
  onSelectSessionModel,
}: VisualizationViewProps) {
  if (guide === 'home') {
    return <GuideLanding hasSession={Boolean(session)} onOpenGuide={onOpenGuide} />;
  }

  return (
    <>
      <GuideSwitcher guide={guide} onOpenGuide={onOpenGuide} />
      {guide === 'stimuli' && session && (
        <SessionBanner
          session={session}
          focusedStimulusId={focusedStimulusId}
          onFocusStimulus={onFocusStimulus}
          selectedModel={selectedCell?.model ?? null}
          onSelectModel={onSelectSessionModel}
        />
      )}
      {guide === 'models' ? (
        <div className="workspace-grid">
          <aside className="model-browser" aria-label="Model browser">
            <ControlsBar
              rois={heatmapRois}
              rankingSystem={rankingSystem}
              selectedRankingRoi={selectedRankingRoi}
              modelSearch={modelSearch}
              showScoreLabels={showScoreLabels}
              compareMode={compareMode}
              compareSelectionCount={compareCells.length}
              compareFixed
              onRankingSystemChange={onRankingSystemChange}
              onSelectedRankingRoiChange={onSelectedRankingRoiChange}
              onModelSearchChange={onModelSearchChange}
              onShowScoreLabelsChange={onShowScoreLabelsChange}
              onCompareModeChange={onCompareModeChange}
              onResetControls={onResetControls}
            />
            <Heatmap
              cells={heatmapCells}
              models={visibleModels}
              rois={heatmapRois}
              showScoreLabels={showScoreLabels}
              sortDirection={sortDirection}
              selectedCell={selectedCell}
              compareMode={compareMode}
              compareCells={compareCells}
              comparableCellIds={comparableCellIds}
              sessionCellIds={sessionCellIds}
              onSortDirectionToggle={onSortDirectionToggle}
              onSelectCell={onSelectCell}
              selectedRankingRoi={rankingSystem === 'roi' ? selectedRankingRoi : null}
            />
            <HelpBox topic="models" />
          </aside>
          {compareCells.length === 2 ? (
            <CompareDrawer
              heatmapCells={heatmapCells}
              compareMode={compareMode}
              compareCells={compareCells}
              clustering={clustering}
              rows={rows}
              modelRoiColumns={modelRoiColumns}
              topK={6}
            />
          ) : (
            <aside className="details-panel" aria-label="Compare selections">
              <h2>Compare selections</h2>
              <div className="empty-state-card">
                <p>Select two heatmap cells. {compareCells.length} / 2 selected.</p>
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className="workspace-grid workspace-grid--stimuli">
          <StimulusPicker
            models={allModels}
            rois={heatmapRois}
            cells={allHeatmapCells}
            selectedCell={selectedCell}
            onSelectCell={onSelectCell}
          />
          <DetailsPanel
            heatmapCells={allHeatmapCells}
            imageCount={rows.length}
            clustering={clustering}
            modelRoiColumns={modelRoiColumns}
            onSelectCell={onSelectCell}
            rows={rows}
            selectedCell={selectedCell}
            session={session}
            focusedStimulusId={focusedStimulusId}
            onFocusStimulus={onFocusStimulus}
          />
          <HelpBox topic="stimuli" />
        </div>
      )}
    </>
  );
}
