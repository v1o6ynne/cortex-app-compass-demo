import { CompareDrawer } from './CompareDrawer';
import { ControlsBar } from './ControlsBar';
import { DetailsPanel } from './DetailsPanel';
import { GuideLanding } from './GuideLanding';
import { GuideSwitcher } from './GuideSwitcher';
import { Heatmap } from './Heatmap';
import { HelpBox } from './HelpBox';
import { SessionBanner } from './SessionBanner';
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

  const comparingModels = guide === 'models';
  const heatmapRoisToShow = comparingModels && rankingSystem === 'roi'
    ? heatmapRois.filter((roi) => roi === selectedRankingRoi)
    : heatmapRois;
  const heatmapCellsToShow = comparingModels && rankingSystem === 'roi'
    ? heatmapCells.filter((cell) => cell.roi === selectedRankingRoi)
    : heatmapCells;

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
      <div className="workspace-grid">
        <aside className="model-browser" aria-label="Model browser">
          <ControlsBar
            rois={heatmapRois}
            rankingSystem={rankingSystem}
            selectedRankingRoi={selectedRankingRoi}
            modelSearch={modelSearch}
            showScoreLabels={showScoreLabels}
            compareMode={comparingModels && compareMode}
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
            cells={heatmapCellsToShow}
            models={visibleModels}
            rois={heatmapRoisToShow}
            showScoreLabels={showScoreLabels}
            sortDirection={sortDirection}
            selectedCell={selectedCell}
            compareMode={comparingModels && compareMode}
            compareCells={comparingModels ? compareCells : []}
            comparableCellIds={comparableCellIds}
            sessionCellIds={sessionCellIds}
            onSortDirectionToggle={onSortDirectionToggle}
            onSelectCell={onSelectCell}
          />
          <HelpBox topic={comparingModels ? 'models' : 'stimuli'} />
        </aside>
        {comparingModels ? (
          compareCells.length === 2 ? (
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
          )
        ) : (
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
        )}
      </div>
    </>
  );
}
