import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EvidenceImage } from '../types/data';
import {
  topRankDisagreements,
  type SharedResponsePoint,
} from '../utils/responseComparison';

export function comparisonModelLabel(model: string): string {
  return ({ clip_rn50: 'CLIP RN50', clip_rn101: 'CLIP RN101', clip_vit_b32: 'CLIP ViT-B/32' } as Record<string, string>)[model] ?? model;
}

type Props = {
  points: SharedResponsePoint[];
  xLabel: string;
  yLabel: string;
  roiLabel: string;
  onOpenImage: (image: EvidenceImage) => void;
  compact?: boolean;
};

const BLUE = '#2468A0';
const RED = '#C33C3C';
const W = 420;
const H = 560;
const TOP = 36;
const BOTTOM = 28;
const LEFT_X = 88;
const RIGHT_X = 332;

function rankTicks(maxRank: number): number[] {
  if (maxRank <= 1) return [1];
  const step = maxRank <= 40 ? 5 : maxRank <= 100 ? 20 : 40;
  const ticks = [1];
  for (let tick = step; tick < maxRank; tick += step) ticks.push(tick);
  if (ticks[ticks.length - 1] !== maxRank) ticks.push(maxRank);
  return ticks;
}

export function CompareResponseScatter({ points, xLabel, yLabel, roiLabel, onOpenImage, compact = false }: Props) {
  type Preview = { point: SharedResponsePoint; x: number; y: number };
  const [hoverPreview, setHoverPreview] = useState<Preview | null>(null);
  const [focusPreview, setFocusPreview] = useState<Preview | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const preview = hoverPreview ?? focusPreview;
  const previewVisible = preview !== null;
  const tooltipId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const listLimit = compact ? 5 : 8;
  const disagreements = useMemo(() => topRankDisagreements(points, listLimit), [listLimit, points]);
  const highlighted = useMemo(
    () => new Set(disagreements.map((point) => point.imageName)),
    [disagreements],
  );
  const maxRank = Math.max(1, ...points.flatMap((point) => [point.rankA, point.rankB]));
  const plotHeight = H - TOP - BOTTOM;
  const scaleY = (rank: number) => TOP + ((rank - 1) / Math.max(maxRank - 1, 1)) * plotHeight;
  const ticks = rankTicks(maxRank);

  const orderedPoints = useMemo(() => {
    const background = points.filter((point) => !highlighted.has(point.imageName));
    const foreground = points.filter((point) => highlighted.has(point.imageName));
    return [...background, ...foreground];
  }, [highlighted, points]);

  function openPoint(point: SharedResponsePoint) {
    onOpenImage({
      imageName: point.imageName,
      imageUrl: point.imageUrl,
      value: point.meanB,
      rank: point.rankB,
      valueLabel: `${xLabel} #${point.rankA} · ${yLabel} #${point.rankB} · Δrank ${point.rankDelta >= 0 ? '+' : ''}${point.rankDelta}`,
    });
  }

  useEffect(() => {
    if (!preview) return;
    const dismiss = () => { setHoverPreview(null); setFocusPreview(null); };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [previewVisible]);

  function showPreview(point: SharedResponsePoint, element: SVGElement, trigger: 'hover' | 'focus') {
    const rect = element.getBoundingClientRect();
    const width = 270;
    const next = {
      point,
      x: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right + 14)),
      y: Math.max(8, Math.min(window.innerHeight - 270 - 8, rect.top - 40)),
    };
    if (trigger === 'focus') { setHoverPreview(null); setFocusPreview(next); }
    else setHoverPreview(next);
  }

  function moveFocus(index: number, delta: number) {
    const nodes = figureRef.current?.querySelectorAll<SVGGElement>('[data-response-image]');
    if (!nodes?.length) return;
    nodes[(index + delta + nodes.length) % nodes.length].focus();
  }

  function lineColor(point: SharedResponsePoint, active: boolean): string {
    if (!active) return 'var(--border)';
    if (point.rankLead === 'b') return BLUE;
    if (point.rankLead === 'a') return RED;
    return '#6b7280';
  }

  return (
    <section className="compare-response-section" aria-label={`${xLabel} versus ${yLabel} rank slopegraph`}>
      <div className="compare-response-intro">
        <h3>{xLabel} → {yLabel}</h3>
        <span>{points.length} images · {roiLabel} · crossing lines = rank shifts</span>
      </div>
      <div className="compare-response-layout">
        <figure className="compare-response-figure compare-rank-slope-figure" ref={figureRef}>
          <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${xLabel} versus ${yLabel} response ranks`}>
            <text className="compare-rank-slope-axis-title" x={LEFT_X} y={18} textAnchor="middle">{xLabel}</text>
            <text className="compare-rank-slope-axis-title" x={RIGHT_X} y={18} textAnchor="middle">{yLabel}</text>
            <line className="compare-rank-slope-axis" x1={LEFT_X} y1={TOP} x2={LEFT_X} y2={TOP + plotHeight} />
            <line className="compare-rank-slope-axis" x1={RIGHT_X} y1={TOP} x2={RIGHT_X} y2={TOP + plotHeight} />
            {ticks.map((tick) => (
              <g key={tick} className="compare-rank-slope-tick">
                <line x1={LEFT_X - 5} y1={scaleY(tick)} x2={LEFT_X} y2={scaleY(tick)} />
                <line x1={RIGHT_X} y1={scaleY(tick)} x2={RIGHT_X + 5} y2={scaleY(tick)} />
                <text x={LEFT_X - 10} y={scaleY(tick) + 4} textAnchor="end">#{tick}</text>
                <text x={RIGHT_X + 10} y={scaleY(tick) + 4} textAnchor="start">#{tick}</text>
              </g>
            ))}
            <text className="compare-rank-slope-end-label" x={LEFT_X} y={H - 8} textAnchor="middle">rank 1 at top</text>

            {orderedPoints.map((point, index) => {
              const isHighlight = highlighted.has(point.imageName);
              const isHovered = hoveredName === point.imageName;
              const active = isHighlight || isHovered;
              const y1 = scaleY(point.rankA);
              const y2 = scaleY(point.rankB);
              const color = lineColor(point, active);
              return (
                <g
                  key={point.imageName}
                  role="button"
                  tabIndex={0}
                  className={`compare-rank-slope-item${active ? ' is-active' : ''}`}
                  data-response-image={point.imageId}
                  data-rank-lead={point.rankLead ?? ''}
                  data-rank-delta={point.rankDelta}
                  aria-label={`${point.imageId}; ${xLabel} rank ${point.rankA}; ${yLabel} rank ${point.rankB}; Δrank ${point.rankDelta}`}
                  aria-describedby={preview?.point.imageName === point.imageName ? tooltipId : undefined}
                  onMouseEnter={(event) => {
                    setHoveredName(point.imageName);
                    showPreview(point, event.currentTarget, 'hover');
                  }}
                  onMouseLeave={() => {
                    setHoveredName(null);
                    setHoverPreview(null);
                  }}
                  onFocus={(event) => {
                    setHoveredName(point.imageName);
                    showPreview(point, event.currentTarget, 'focus');
                  }}
                  onBlur={() => {
                    setHoveredName(null);
                    setFocusPreview(null);
                  }}
                  onClick={() => openPoint(point)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPoint(point); }
                    if (event.key === 'Escape') {
                      setHoverPreview(null); setFocusPreview(null); setHoveredName(null);
                    }
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index, 1); }
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index, -1); }
                  }}
                >
                  <line
                    className="compare-rank-slope-hit"
                    x1={LEFT_X}
                    y1={y1}
                    x2={RIGHT_X}
                    y2={y2}
                  />
                  <line
                    className="compare-rank-slope-line"
                    x1={LEFT_X}
                    y1={y1}
                    x2={RIGHT_X}
                    y2={y2}
                    stroke={color}
                    strokeWidth={active ? 2.4 : 1}
                    opacity={active ? 0.95 : 0.12}
                  />
                  <circle cx={LEFT_X} cy={y1} r={active ? 3.6 : 2} fill={color} opacity={active ? 1 : 0.2} />
                  <circle cx={RIGHT_X} cy={y2} r={active ? 3.6 : 2} fill={color} opacity={active ? 1 : 0.2} />
                </g>
              );
            })}
          </svg>
          <figcaption>
            Left = {xLabel} rank, right = {yLabel} rank (1 = highest ROI mean). Steeper lines = larger rank shifts.
            Color marks the largest |Δrank|.
          </figcaption>
        </figure>

        <div className="compare-gap-examples" aria-label={`Largest rank disagreements versus ${yLabel}`}>
          <section className="compare-rank-disagreement-list">
            <h4>Largest |Δrank| vs human</h4>
            <div className="compare-rank-disagreement-grid">
              {disagreements.map((point) => {
                const aPos = Math.min(point.rankA, point.rankB);
                const bPos = Math.max(point.rankA, point.rankB);
                const leftPct = ((aPos - 1) / Math.max(maxRank - 1, 1)) * 100;
                const widthPct = ((bPos - aPos) / Math.max(maxRank - 1, 1)) * 100;
                return (
                  <button
                    type="button"
                    className={`compare-rank-disagreement compare-rank-disagreement--${point.rankLead ?? 'tie'}`}
                    key={point.imageName}
                    onClick={() => openPoint(point)}
                    onMouseEnter={() => setHoveredName(point.imageName)}
                    onMouseLeave={() => setHoveredName(null)}
                    aria-label={`Open ${point.imageId}; Δrank ${point.rankDelta}`}
                  >
                    <img src={point.imageUrl} alt="" />
                    <div className="compare-rank-disagreement-body">
                      <strong>{point.imageId}</strong>
                      <span>{xLabel} #{point.rankA} → {yLabel} #{point.rankB}</span>
                      <span className="compare-rank-delta">
                        Δrank {point.rankDelta >= 0 ? '+' : ''}{point.rankDelta}
                        {point.rankLead === 'a' ? ` · higher in ${xLabel}` : point.rankLead === 'b' ? ` · higher in ${yLabel}` : ''}
                      </span>
                      <div className="compare-rank-dumbbell" aria-hidden="true">
                        <span className="compare-rank-dumbbell-track" />
                        <span
                          className="compare-rank-dumbbell-span"
                          style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1.5)}%` }}
                        />
                        <span
                          className="compare-rank-dumbbell-dot compare-rank-dumbbell-dot--a"
                          style={{ left: `${((point.rankA - 1) / Math.max(maxRank - 1, 1)) * 100}%` }}
                        />
                        <span
                          className="compare-rank-dumbbell-dot compare-rank-dumbbell-dot--b"
                          style={{ left: `${((point.rankB - 1) / Math.max(maxRank - 1, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {disagreements.length === 0 ? (
              <p>No rank disagreements on the shared references.</p>
            ) : (
              <p>Red = ranked higher by {xLabel}; blue = ranked higher by {yLabel}.</p>
            )}
          </section>
        </div>
      </div>
      {preview && createPortal(
        <div className="compare-response-tooltip" id={tooltipId} role="tooltip" style={{ left: preview.x, top: preview.y }}>
          <img src={preview.point.imageUrl} alt="" />
          <strong>{preview.point.imageId}</strong>
          <table>
            <thead><tr><th>Source</th><th>Rank</th><th>Mean</th></tr></thead>
            <tbody>
              <tr><th>{xLabel}</th><td>#{preview.point.rankA}</td><td>{preview.point.meanA.toFixed(3)}</td></tr>
              <tr><th>{yLabel}</th><td>#{preview.point.rankB}</td><td>{preview.point.meanB.toFixed(3)}</td></tr>
            </tbody>
          </table>
          <span>Δrank {preview.point.rankDelta >= 0 ? '+' : ''}{preview.point.rankDelta}. Click to open.</span>
        </div>,
        document.body,
      )}
    </section>
  );
}
