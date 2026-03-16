

## Problema Identificado

Analisando os dados da API, o problema é claro:

1. **Alcance (reach)** funciona com `time_series` e retorna dados diários (4k-11k por dia) -- OK
2. **Visualizações (views)** retorna `total_value` apenas e é atribuído somente ao dia de hoje (467k), enquanto todos os outros dias ficam com 0. Isso distorce completamente o gráfico, pois a escala do eixo Y vai até 467k, tornando a linha de alcance invisível.
3. **Seguidores (follows/unfollows)** retorna 0 para todos os dias -- a API Meta v21+ não fornece breakdown diário para `follows_and_unfollows`, só `total_value` sem granularidade.

## Plano de Correção

### 1. Remodelar o gráfico de Performance (`InstagramPerformanceChart.tsx`)
- **Remover a aba "Novos Seguidores"** (dados sempre zerados, não faz sentido mostrar)
- **Separar Alcance e Visualizações** em dois gráficos independentes, ou mostrar apenas Alcance como gráfico principal (já que Views só tem 1 data point válido)
- Mostrar um **AreaChart limpo** só com Alcance diário, com:
  - Legenda visível (usando `<Legend>` do Recharts)
  - Tooltip formatado com nome da métrica e valor
  - Eixo X com datas legíveis
  - Eixo Y com formatação (k, M)
  - Gradiente de cor para a área
- Adicionar indicador do período ("Últimos 30 dias")

### 2. Remover card "Novos Seguidores" do MetricsGrid (`InstagramMetricsGrid.tsx`)
- Remover o item `{ label: 'Novos Seguidores' }` do array de cards, já que a métrica sempre retorna 0

### Arquivos a editar
- `src/components/instagram/InstagramPerformanceChart.tsx` -- redesign completo
- `src/components/instagram/InstagramMetricsGrid.tsx` -- remover card de novos seguidores

