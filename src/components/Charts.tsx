/**
 * Diagramme (Chart.js). Einheitliche Gestaltung: dünne Marken, zurückhaltende Achsen,
 * Hover-Tooltips, optional Tabellenansicht für Barrierefreiheit.
 */
import { useMemo, useState } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Table2 } from 'lucide-react';
import { useApp } from '../store/appStore';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

function useChartColors() {
  const theme = useApp((s) => s.settings.theme);
  const accentKey = useApp((s) => s.settings.accent);
  return useMemo(() => {
    const light = theme === 'light';
    const accent = accentKey === 'lime' ? (light ? '#4d7c0f' : '#bef264') : light ? '#a17800' : '#fdc910';
    return {
      accent,
      accentSoft: accentKey === 'lime' ? 'rgba(190,242,100,0.12)' : 'rgba(253,201,16,0.12)',
      secondary: light ? '#52525b' : '#a1a1aa',
      grid: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
      tick: light ? '#52525b' : '#a1a1aa',
      surface: light ? '#ffffff' : '#141416',
      text: light ? '#141416' : '#f5f5f4',
    };
  }, [theme, accentKey]);
}

export interface Series {
  label: string;
  data: (number | null)[];
  /** gestrichelt (z. B. Schätzwerte) */
  dashed?: boolean;
  secondary?: boolean;
}

interface ChartProps {
  labels: string[];
  series: Series[];
  unit?: string;
  height?: number;
  ariaLabel: string;
  digits?: number;
}

function baseOptions(c: ReturnType<typeof useChartColors>, unit: string | undefined, digits: number, showLegend: boolean): ChartOptions<'line' | 'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: showLegend, position: 'top', align: 'end', labels: { color: c.tick, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } } },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.text,
        bodyColor: c.text,
        borderColor: c.grid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined) return `${ctx.dataset.label}: –`;
            return `${ctx.dataset.label}: ${v.toLocaleString('de-DE', { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: c.grid }, ticks: { color: c.tick, maxRotation: 0, autoSkipPadding: 12, font: { size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: c.grid },
        border: { display: false },
        ticks: { color: c.tick, font: { size: 11 }, precision: digits === 0 ? 0 : undefined, callback: (v) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: digits }) },
      },
    },
  };
}

function TableToggle({ labels, series, unit, digits }: { labels: string[]; series: Series[]; unit?: string; digits: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Table2 size={14} aria-hidden="true" /> {open ? 'Tabelle ausblenden' : 'Als Tabelle anzeigen'}
      </button>
      {open && (
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border hairline">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-elevated text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2">Zeitpunkt</th>
                {series.map((s) => (
                  <th key={s.label} className="px-3 py-2">
                    {s.label}
                    {unit ? ` (${unit})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i} className="border-t hairline">
                  <td className="px-3 py-1.5 text-muted">{l}</td>
                  {series.map((s) => (
                    <td key={s.label} className="px-3 py-1.5 tabular-nums">
                      {s.data[i] === null ? '–' : s.data[i]!.toLocaleString('de-DE', { maximumFractionDigits: digits })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LineChart({ labels, series, unit, height = 260, ariaLabel, digits = 1 }: ChartProps) {
  const c = useChartColors();
  const data = {
    labels,
    datasets: series.map((s) => {
      const color = s.secondary ? c.secondary : c.accent;
      return {
        label: s.label,
        data: s.data,
        borderColor: color,
        backgroundColor: s.secondary ? 'transparent' : c.accentSoft,
        fill: !s.secondary && series.length === 1,
        borderWidth: 2,
        borderDash: s.dashed ? [5, 4] : undefined,
        tension: 0.3,
        pointRadius: labels.length > 20 ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: c.surface,
        pointBorderWidth: 2,
        spanGaps: true,
      };
    }),
  };
  return (
    <div>
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <Line data={data} options={baseOptions(c, unit, digits, series.length > 1) as ChartOptions<'line'>} />
      </div>
      <TableToggle labels={labels} series={series} unit={unit} digits={digits} />
    </div>
  );
}

export function BarChart({ labels, series, unit, height = 240, ariaLabel, digits = 0 }: ChartProps) {
  const c = useChartColors();
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.secondary ? c.secondary : c.accent,
      hoverBackgroundColor: s.secondary ? c.secondary : c.accent,
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: 'bottom' as const,
      maxBarThickness: 28,
      categoryPercentage: 0.7,
      barPercentage: 0.9,
    })),
  };
  return (
    <div>
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <Bar data={data} options={baseOptions(c, unit, digits, series.length > 1) as ChartOptions<'bar'>} />
      </div>
      <TableToggle labels={labels} series={series} unit={unit} digits={digits} />
    </div>
  );
}
