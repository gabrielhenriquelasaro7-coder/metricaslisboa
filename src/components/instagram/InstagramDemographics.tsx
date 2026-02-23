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
  // Handle both old format {name: value} and new format {name: value}
  return Object.entries(data)
    .map(([name, value]) => ({ name, value: value as number }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function InstagramDemographics({ insights }: Props) {
  // Find any insight row that has demographics
  const latest = insights.find(i => {
    const fd = i.follower_demographics;
    const ed = i.engaged_demographics;
    // Check if demographics have actual data (not empty objects)
    const hasFollower = fd && typeof fd === 'object' && Object.keys(fd).length > 0;
    const hasEngaged = ed && typeof ed === 'object' && Object.keys(ed).length > 0;
    return hasFollower || hasEngaged;
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

  const demo = latest.follower_demographics || latest.engaged_demographics || {};

  const genderData = parseDemoData(demo, 'gender').map(d => ({
    ...d,
    name: d.name === 'M' ? 'Masculino' : d.name === 'F' ? 'Feminino' : d.name === 'U' ? 'Outro' : d.name,
  }));
  const ageData = parseDemoData(demo, 'age');
  const cityData = parseDemoData(demo, 'city').slice(0, 10);
  const countryData = parseDemoData(demo, 'country').slice(0, 10);

  const hasAnyData = genderData.length > 0 || ageData.length > 0 || cityData.length > 0 || countryData.length > 0;

  if (!hasAnyData) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
          <Info className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dados demográficos carregados mas sem valores</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
              Tente sincronizar novamente. Os dados demográficos podem levar algumas horas para ficarem disponíveis.
            </p>
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

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Demografia dos Seguidores</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {genderData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Gênero</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {genderData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {ageData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Faixa Etária</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Seguidores" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {cityData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Principais Cidades</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cityData.map((c, i) => {
                  const max = cityData[0]?.value || 1;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span>{c.name}</span>
                          <span className="text-muted-foreground">{c.value.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(c.value / max) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {countryData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Principais Países</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {countryData.map((c, i) => {
                  const max = countryData[0]?.value || 1;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span>{c.name}</span>
                          <span className="text-muted-foreground">{c.value.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${(c.value / max) * 100}%` }} />
                        </div>
                      </div>
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
