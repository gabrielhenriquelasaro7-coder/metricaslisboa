import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface PerformanceChartProps {
  data: Array<{
    date: string;
    value: number;
    value2?: number;
  }>;
  title: string;
  dataKey: string;
  dataKey2?: string;
  color?: string;
  color2?: string;
  className?: string;
}

export default function PerformanceChart({
  data,
  title,
  dataKey,
  dataKey2,
  color = 'hsl(var(--primary))',
  color2 = 'hsl(280, 100%, 70%)',
  className,
}: PerformanceChartProps) {
  return (
    <div className={cn('glass-card p-6', className)}>
      <h3 className="text-lg font-semibold mb-6">{title}</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 16%)" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 8%)',
                border: '1px solid hsl(222, 47%, 16%)',
                borderRadius: '8px',
                padding: '12px',
              }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={{ r: 4, fill: color, stroke: color, strokeWidth: 1 }}
              activeDot={{ r: 6, fill: color, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
            {dataKey2 && (
              <Line
                type="monotone"
                dataKey={dataKey2}
                stroke={color2}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 4, fill: color2, stroke: color2, strokeWidth: 1 }}
                activeDot={{ r: 6, fill: color2, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
