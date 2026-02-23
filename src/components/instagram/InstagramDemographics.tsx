import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Info } from 'lucide-react';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#10b981', '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#a855f7'];

function parseDemoData(demographics: any, key: string) {
  if (!demographics || !demographics[key]) return [];
  const data = demographics[key];
  return Object.entries(data)
    .map(([name, value]) => ({ name, value: value as number }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function InstagramDemographics({ insights }: Props) {
  // Find any insight that has demographics data
  const latest = insights.find(i => {
    const fd = i.follower_demographics;
    const ed = i.engaged_demographics;
    const rd = i.reached_demographics;
    return (fd && typeof fd === 'object' && Object.keys(fd).length > 0) ||
           (ed && typeof ed === 'object' && Object.keys(ed).length > 0) ||
           (rd && typeof rd === 'object' && Object.keys(rd).length > 0);
  });

  if (!latest) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
          <Info className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dados demográficos não disponíveis</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
              Sincronize novamente para carregar dados demográficos. A conta precisa ter mais de 100 seguidores.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use follower_demographics first, then engaged, then reached
  const demo = latest.follower_demographics || latest.engaged_demographics || latest.reached_demographics || {};

  // Parse gender - keys might be "M", "F", "U" or full words
  const genderData = parseDemoData(demo, 'gender').map(d => ({
    ...d,
    name: d.name === 'M' ? 'Masculino' : d.name === 'F' ? 'Feminino' : d.name === 'U' ? 'Não Informado' : d.name,
  }));
  const ageData = parseDemoData(demo, 'age');
  const cityData = parseDemoData(demo, 'city').slice(0, 8);
  const countryData = parseDemoData(demo, 'country').slice(0, 8);

  const hasAnyData = genderData.length > 0 || ageData.length > 0 || cityData.length > 0 || countryData.length > 0;

  if (!hasAnyData) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
          <Info className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dados demográficos sem valores</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Tente sincronizar novamente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: 12,
  };

  // Calculate gender percentages
  const genderTotal = genderData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Dados Demográficos</h3>
        <p className="text-xs text-muted-foreground">Dados em tempo real, não filtrados por período.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gender & Age combined */}
        {(genderData.length > 0 || ageData.length > 0) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Gênero e Idade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {genderData.length > 0 && (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                        {genderData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex items-center justify-center gap-4 text-xs text-foreground">
                {genderData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-foreground">{d.name} {genderTotal > 0 ? `${((d.value / genderTotal) * 100).toFixed(0)}%` : ''}</span>
                  </div>
                ))}
              </div>
              {ageData.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  {ageData.slice(0, 5).map((a, i) => {
                    const max = ageData[0]?.value || 1;
                    const total = ageData.reduce((s, d) => s + d.value, 0);
                    return (
                      <div key={a.name} className="flex items-center gap-2 text-xs">
                        <span className="w-14 text-muted-foreground shrink-0">{a.name}</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(a.value / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-muted-foreground w-14 text-right">{a.value.toLocaleString('pt-BR')} ({((a.value / total) * 100).toFixed(1)}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cities */}
        {cityData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Principais Cidades</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={cityData.slice(0, 5)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                      {cityData.slice(0, 5).map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] mb-3 text-foreground">
                {cityData.slice(0, 5).map((c, i) => {
                  const total = cityData.reduce((s, d) => s + d.value, 0);
                  return (
                    <div key={c.name} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(i + 2) % COLORS.length] }} />
                      <span className="text-foreground">{c.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1.5 border-t border-border/50 pt-2">
                {cityData.map((c) => {
                  const total = cityData.reduce((s, d) => s + d.value, 0);
                  return (
                    <div key={c.name} className="flex justify-between text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.value.toLocaleString('pt-BR')} ({((c.value / total) * 100).toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Countries */}
        {countryData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Países</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={countryData.slice(0, 5)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                      {countryData.slice(0, 5).map((_, i) => <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] mb-3 text-foreground">
                {countryData.slice(0, 5).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(i + 4) % COLORS.length] }} />
                    <span className="text-foreground">{c.name}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-border/50 pt-2">
                {countryData.map((c) => {
                  const total = countryData.reduce((s, d) => s + d.value, 0);
                  return (
                    <div key={c.name} className="flex justify-between text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.value.toLocaleString('pt-BR')} ({((c.value / total) * 100).toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
