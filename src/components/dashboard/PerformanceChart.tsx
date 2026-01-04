import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  color = 'hsl(199, 89%, 48%)',
  color2 = 'hsl(280, 100%, 70%)',
  className,
}: PerformanceChartProps) {
  return (
    <div className={cn('glass-card p-6', className)}>
      <h3 className="text-lg font-semibold mb-6">{title}</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              {dataKey2 && (
                <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color2} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color2} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
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
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              strokeDasharray="6 3"
              fillOpacity={1}
              fill="url(#colorValue)"
            />
            {dataKey2 && (
              <Area
                type="monotone"
                dataKey={dataKey2}
                stroke={color2}
                strokeWidth={2.5}
                strokeDasharray="6 3"
                fillOpacity={1}
                fill="url(#colorValue2)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
