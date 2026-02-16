
# Plano Completo: Meta Ads, Home, Carregamento e Correções

## 1. Meta Ads - Cards de Resultado MENORES (SparklineCard)

**Problema**: Os SparklineCards de resultado continuam grandes (imagem-432 mostra cards enormes).

**Solução**:
- No `SparklineCard.tsx`, reduzir padding de `p-3` para `p-2 sm:p-2.5`
- Reduzir titulo de `text-sm` para `text-[10px] sm:text-xs`
- Reduzir valor de `text-lg sm:text-xl` para `text-sm sm:text-base`
- Reduzir altura do sparkline de `h-[60px]` para `h-[40px]`
- Nos grids de resultado no MetaAds.tsx, reduzir gap de `gap-2 sm:gap-2.5` para `gap-1.5 sm:gap-2`

## 2. Meta Ads - Modal do Criativo MAIOR e com mais info

**Problema**: Modal pequeno (max-w-3xl), imagem cortada, falta informações como headline e texto principal (imagem-433 mostra referência do que deveria ter).

**Solução**:
- Aumentar `DialogContent` de `max-w-3xl` para `max-w-5xl`
- Mudar layout: imagem ocupa lado esquerdo com `aspect-auto` (sem forçar quadrado) para não cortar
- Lado direito: grid 2x4 com métricas (Gasto, Conversões, CTR, CPC, CPM, Impressões, Cliques, Alcance)
- Abaixo das métricas: Headline e Texto Principal
- Remover qualquer barra de frequência

## 3. Meta Ads - Remover "100,0%" do Investimento

**Problema**: No card de investimento nas Métricas Gerais aparece "↑100.0%" (imagem-434).

**Solução**:
- Na linha 304 do MetaAds.tsx, remover a exibição condicional de `changes?.spend`
- O card de investimento mostrará apenas o valor, sem porcentagem de variação

## 4. Meta Ads - Métricas do Período (PeriodComparison) consertado

**Problema**: A seção "Métricas do Período" está bugada (imagem-432 mostra "comparison.current" como texto raw).

**Solução**:
- O label `currentPeriodLabel` está usando `t('comparison.current')` que não existe na tradução
- Corrigir no MetaAds.tsx para usar labels corretos sem depender de chaves de tradução ausentes
- Reduzir padding do componente PeriodComparison: de `p-6` para `p-4`, grid gap de `gap-4` para `gap-3`
- Cards internos de `p-2.5 sm:p-4` para `p-2 sm:p-3`

## 5. Meta Ads - AccountBalanceCard menor

**Solução**:
- Reduzir padding de `pt-3 pb-3 px-4` para `pt-2 pb-2 px-3`
- Reduzir icone de `w-4 h-4` para `w-3.5 h-3.5`
- Reduzir fonte do valor de `text-base` para `text-sm`

## 6. Meta Ads - Filtros no Funil de Vendas

**Solução**:
- Adicionar dropdown/select no header do FunnelChart para filtrar por: Todas, Campanhas Ativas, Campanhas Pausadas
- Passar filtro como prop do MetaAds para o FunnelChart

## 7. Home - Gráficos comparativos Meta vs Google

**Problema**: Os gráficos da Home ainda mostram apenas dados do Meta, não comparam com Google.

**Solução**:
- Modificar os `CustomizableChart` na Home para usar `comparativeData` que já foi criado (linha 119-129)
- Passar as keys `meta_spend` e `google_spend` como métricas separadas
- Alternativa mais simples: adicionar labels "Meta" e "Google" nos gráficos e usar os dados combinados

## 8. Home - Botão "Novo Projeto" menor

**Problema**: O `CreateProjectDialog` renderiza um botão `variant="gradient"` com texto "Novo Projeto" que é grande demais.

**Solução**:
- No CreateProjectDialog.tsx, mudar o trigger para `size="sm"` com padding reduzido
- Mudar para: `<Button variant="outline" size="sm"><Plus className="w-3.5 h-3.5 mr-1" />Novo</Button>`

## 9. Carregamento em TODAS as telas

**Problema**: Ao trocar de aba ou projeto, a tela pisca sem loading.

**Solução**:
- O `App.tsx` já usa `mode="popLayout"` e `duration: 0.1` (correto)
- O problema é que nem todas as páginas usam `SmoothLoader`
- Verificar e adicionar `SmoothLoader` com `DashboardSkeleton` nas páginas: WhatsApp, Settings, GoogleCampaigns, Analytics, Financial, PredictiveAnalysis
- No `SmoothLoader`, reduzir delay de conteúdo de `0.05` para `0` para transição mais rápida

## Detalhes Técnicos

### Arquivos a modificar:
1. **`src/components/dashboard/SparklineCard.tsx`** - Reduzir tamanhos (padding, fontes, sparkline height)
2. **`src/pages/MetaAds.tsx`** - Modal maior, remover % investimento, labels corrigidos
3. **`src/components/dashboard/PeriodComparison.tsx`** - Compactar padding e grid
4. **`src/components/dashboard/AccountBalanceCard.tsx`** - Compactar
5. **`src/components/projects/CreateProjectDialog.tsx`** - Botão menor
6. **`src/pages/Dashboard.tsx`** - Gráficos comparativos Meta vs Google
7. **`src/components/dashboard/FunnelChart.tsx`** - Adicionar filtros
8. **`src/components/layout/PageTransition.tsx`** - Remover delay do SmoothLoader
9. Páginas faltando SmoothLoader (WhatsApp, etc.)

### Sequência:
1. SparklineCard + AccountBalanceCard - compactar
2. MetaAds - modal maior, remover %, corrigir labels
3. PeriodComparison - compactar
4. CreateProjectDialog - botão menor
5. Dashboard - gráficos comparativos
6. FunnelChart - filtros
7. PageTransition + páginas restantes - carregamento universal
