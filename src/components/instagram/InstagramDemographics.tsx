import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { InstagramInsightsDaily } from '@/hooks/useInstagramData';

interface Props {
  insights: InstagramInsightsDaily[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#10b981', '#eab308', '#ec4899', '#3b82f6'];

function parseDemoData(demographics: any, key: string) {
  if (!demographics || !demographics[key]) return [];
  const data = demographics[key];
  return Object.entries(data)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);
}

export default function InstagramDemographics({ insights }: Props) {
  // Use the latest demographic data available
  const latest = insights.find(i => i.follower_demographics || i.engaged_demographics);
  if (!latest) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Dados demográficos não disponíveis. Sincronize os dados do Instagram.
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Gender donut */}
      {genderData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Gênero</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {genderData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Age bar chart */}
      {ageData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Faixa Etária</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top cities */}
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

      {/* Top countries */}
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
  );
}
