import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface ChartProps<T extends object> {
  title: string;
  subtitle?: string;
  data: T[];
  dataKey: string;
  xAxisKey?: string;
  unit?: string;
  color?: string;
  height?: number;
}

export function Chart<T extends object>({
  title,
  subtitle,
  data,
  dataKey,
  xAxisKey = 'time',
  unit = '',
  color = '#2563eb', // blue-600
  height = 260,
}: ChartProps<T>): React.ReactElement {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey={xAxisKey}
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderRadius: '0.75rem',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                color: '#0f172a',
              }}
              formatter={(val) => [
                typeof val === 'number'
                  ? `${val.toLocaleString()} ${unit}`.trim()
                  : `${String(val ?? '')} ${unit}`.trim(),
                title,
              ]}
              labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
