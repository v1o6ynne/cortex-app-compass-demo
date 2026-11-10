import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EvidenceImage } from '../types/data';
import {
  rankAxisDomain,
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
const W = 510;
const H = 500;
const LEFT = 72;
const TOP = 24;
const SIDE = 400;

function rankTicks(low: number, high: number): number[] {
  const start = Math.max(1, Math.ceil(low));
  const end = Math.floor(high);
  if (end <= start) return [start];
  const span = end - start;
  const step = span <= 10 ? 1 : span <= 40 ? 5 : span <= 100 ? 20 : 40;
  const ticks = [1];
  for (let tick = start - ((start - 1) % step) + (start === 1 ? step : 0); tick <= end; tick += step) {
    if (tick > 1) ticks.push(tick);
  }
  if (ticks[ticks.length - 1] !== end) ticks.push(end);
  return ticks;
}

export function CompareResponseScatter({ points, xLabel, yLabel, roiLabel, onOpenImage, compact = false }: Props) {
  type Preview = { point: SharedResponsePoint; x: number; y: number };
  const [hoverPreview, setHoverPreview] = useState<Preview | null>(null);
  const [focusPreview, setFocusPreview] = useState<Preview | null>(null);
  const preview = hoverPreview ?? focusPreview;
  const previewVisible = preview !== null;
  const tooltipId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const [low, high] = rankAxisDomain(points);
  const scaleX = (value: number) => LEFT + (value - low) / (high - low) * SIDE;
  const scaleY = (value: number) => TOP + SIDE - (value - low) / (high - low) * SIDE;
  const ticks = rankTicks(low, high);
  const listLimit = compact ? 5 : 8;
  const disagreements = useMemo(() => topRankDisagreements(points, listLimit), [listLimit, points]);
  const highlighted = useMemo(
    () => new Set(disagreements.map((point) => point.imageName)),
    [disagreements],
  );
  const maxRank = Math.max(1, ...points.flatMap((point) => [point.rankA, point.rankB]));

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
      y: Math.max(8, Math.min(window.innerHeight - 270 - 8, rect.top - 90)),
    };
    if (trigger === 'focus') { setHoverPreview(null); setFocusPreview(next); }
    else setHoverPreview(next);
  }

  function moveFocus(index: number, delta: number) {
    const nodes = figureRef.current?.querySelectorAll<SVGGElement>('[data-response-image]');
    if (!nodes?.length) return;
    nodes[(index + delta + nodes.length) % nodes.length].focus();
  }

  const orderedPoints = [
    ...points.filter((point) => !highlighted.has(point.imageName)),
    ...points.filter((point) => highlighted.has(point.imageName)),
  ];

  return (
    <section className="compare-response-section" aria-label={`${xLabel} versus ${yLabel} response ranks`}>
      <div className="compare-response-intro">
        <h3>{xLabel} vs {yLabel}</h3>
        <span>{points.length} images · {roiLabel} · near diagonal = similar ranking</span>
      </div>
      <div className="compare-response-layout">
        <figure className="compare-response-figure" ref={figureRef}>
          <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${xLabel} versus ${yLabel} response ranks`}>
            <rect x={LEFT} y={TOP} width={SIDE} height={SIDE} className="compare-response-frame" />
            {ticks.map((tick) => (
              <g key={tick} className="compare-response-axis">
                <line x1={scaleX(tick)} y1={TOP} x2={scaleX(tick)} y2={TOP + SIDE} />
                <line x1={LEFT} y1={scaleY(tick)} x2={LEFT + SIDE} y2={scaleY(tick)} />
                <text x={scaleX(tick)} y={TOP + SIDE + 20} textAnchor="middle">#{tick}</text>
                <text x={LEFT - 12} y={scaleY(tick) + 4} textAnchor="end">#{tick}</text>
              </g>
            ))}
            <line
              className="compare-response-identity"
              x1={scaleX(Math.max(low, 1))}
              y1={scaleY(Math.max(low, 1))}
              x2={scaleX(Math.min(high, maxRank))}
              y2={scaleY(Math.min(high, maxRank))}
            />
            <text className="compare-response-identity-label" x={LEFT + SIDE - 12} y={TOP + 18} textAnchor="end">equal rank</text>
            {orderedPoints.map((point, index) => {
              const isHighlight = highlighted.has(point.imageName);
              const color = point.rankLead === 'b' ? BLUE : point.rankLead === 'a' ? RED : '#929292';
              return (
                <g
                  key={point.imageName}
                  role="button"
                  tabIndex={0}
                  data-response-image={point.imageId}
                  data-rank-lead={point.rankLead ?? ''}
                  data-rank-a={point.rankA}
                  data-rank-b={point.rankB}
                  data-rank-delta={point.rankDelta}
                  aria-label={`${point.imageId}; ${xLabel} rank ${point.rankA}; ${yLabel} rank ${point.rankB}; Δrank ${point.rankDelta}`}
                  aria-describedby={preview?.point.imageName === point.imageName ? tooltipId : undefined}
                  onMouseEnter={(event) => showPreview(point, event.currentTarget, 'hover')}
                  onMouseLeave={() => setHoverPreview(null)}
                  onFocus={(event) => showPreview(point, event.currentTarget, 'focus')}
                  onBlur={() => setFocusPreview(null)}
                  onClick={() => openPoint(point)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPoint(point); }
                    if (event.key === 'Escape') {
                      setHoverPreview(null); setFocusPreview(null);
                    }
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index, 1); }
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index, -1); }
                  }}
                >
                  <circle className="compare-response-hit" cx={scaleX(point.rankA)} cy={scaleY(point.rankB)} r={7} />
                  <circle
                    className="compare-response-point"
                    cx={scaleX(point.rankA)}
                    cy={scaleY(point.rankB)}
                    r={isHighlight ? 5.4 : 3.8}
                    fill={color}
                    opacity={isHighlight ? 1 : 0.55}
                  />
                </g>
              );
            })}
            <text className="compare-response-axis-title" x={LEFT + SIDE / 2} y={H - 20} textAnchor="middle">
              {xLabel} rank
            </text>
            <text className="compare-response-axis-title" transform={`translate(19,${TOP + SIDE / 2}) rotate(-90)`} textAnchor="middle">
              {yLabel} rank
            </text>
          </svg>
          <figcaption>Rank 1 = highest ROI mean. x = measured Murty human; y = model prediction. Color marks largest |Δrank|.</figcaption>
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
