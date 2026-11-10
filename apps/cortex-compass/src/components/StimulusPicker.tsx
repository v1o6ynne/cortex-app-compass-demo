import type { AggregateHeatmapCell, Roi, SelectedHeatmapCell } from '../types/data';

type StimulusPickerProps = {
  models: string[];
  rois: Roi[];
  cells: AggregateHeatmapCell[];
  selectedCell: SelectedHeatmapCell | null;
  onSelectCell: (cell: SelectedHeatmapCell) => void;
};

export function StimulusPicker({ models, rois, cells, selectedCell, onSelectCell }: StimulusPickerProps) {
  const selectableModels = models.filter((model) => model !== 'ceiling');
  const model = selectedCell?.model ?? '';
  const roi = selectedCell?.roi ?? rois[0] ?? 'ffa';

  function select(nextModel: string, nextRoi: Roi) {
    const cell = cells.find((candidate) => candidate.model === nextModel && candidate.roi === nextRoi);
    if (cell) onSelectCell(cell);
  }

  return (
    <section className="controls-bar stimulus-picker" aria-label="Stimulus model and region">
      <label>
        Model
        <select
          value={selectableModels.includes(model) ? model : ''}
          onChange={(event) => select(event.target.value, roi)}
        >
          <option value="" disabled>
            Choose a model
          </option>
          {selectableModels.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Region
        <select
          value={roi}
          onChange={(event) => {
            if (!model) return;
            select(model, event.target.value as Roi);
          }}
          disabled={!model}
        >
          {rois.map((item) => (
            <option key={item} value={item}>
              {item.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
