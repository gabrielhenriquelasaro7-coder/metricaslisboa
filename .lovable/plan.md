# Plano de Melhorias: Home, Meta Ads, WhatsApp e Carregamento

## 1. Home (Dashboard.tsx) - Mais conteudo e espacamento

### Espacamento

- Aumentar `gap-3 sm:gap-4` para `gap-4 sm:gap-5` nos metric cards (ligeiro aumento de tamanho)
- Manter `space-y-6 sm:space-y-8 lg:space-y-10` entre secoes (ja esta bom)
- Garantir `mb-4` entre titulo de secao e conteudo

### Mais conteudo na Home

- Adicionar secao de **Graficos Comparativos Meta vs Google** usando `CustomizableChart` com dados de `dailyData`
- Adicionar um grafico de performance combinado (investimento Meta vs Google ao longo do tempo)
- Colocar + visualizações de conjunto de anúncios...
- O grafico usa o mesmo componente `CustomizableChart` ja existente

### Botao Novo Projeto menor

- Reduzir o `CreateProjectDialog` trigger para `size="sm"` com icone `Plus` menor e sem texto longo

### Regra de "visitas ao perfil" nas Top Campanhas

- Aplicar label `visitas` em vez de `conv.` nas campanhas com objetivo Instagram (ja tem logica `isProfileVisit` mas precisa aplicar no label)

## 2. Meta Ads (MetaAds.tsx) - Cards maiores, criativos em grid

### Cards de metricas

- Aumentar padding de `p-2 sm:p-2.5` para `p-2.5 sm:p-3` (ligeiro aumento)
- Aumentar fonte de `text-[11px] sm:text-xs` para `text-xs sm:text-sm`
- Aumentar espacamento entre secoes de `space-y-3 sm:space-y-6` para `space-y-5 sm:space-y-8`

### Cards de resultado menores

- Manter os SparklineCards com tamanho atual ou reduzir levemente

### Comparacao de periodos menor

- Envolver em container com `scale-[0.95] origin-top-left` ou reduzir padding interno

### Criativos em formato GRID (nao lista)

- Dentro da hierarquia expandida (Campaign > AdSet > **Ads**), trocar a lista de anuncios por um **grid 3 colunas** com thumbnail maior (aspect-square) + nome + gasto
- Cada criativo tera imagem quadrada + metricas abaixo, usando `CreativeImage`

### Espacamento entre secoes

- Adicionar `mt-6 sm:mt-8` entre campanhas e graficos
- Adicionar `mt-6 sm:mt-8` entre graficos e funil
- Adicionar `mt-6 sm:mt-8` entre funil e geografico/demografico

## 3. WhatsApp (WhatsApp.tsx) - Modal maior e mais bonito

### Problema atual

- O modal `ProjectReportConfigDialogNew` usa `max-w-2xl` que e pequeno
- Precisa separar visualmente GT e Planner Monday

### Solucao

- Aumentar `DialogContent` para `max-w-4xl` com `min-h-[70vh]`
- Adicionar backdrop mais opaco (`bg-black/60`)
- Melhorar visual das tabs GT vs Account com icones maiores e descricao
- Adicionar bordas coloridas: GT = verde, Account/Planner = azul

## 4. Carregamento e Animacoes

### Problema

- Ao trocar de aba na sidebar, a tela pisca em vez de ter transicao suave
- O `AnimatePresence` no App.tsx com `mode="wait"` causa flash

### Solucao

- Usar `SmoothLoader` do PageTransition.tsx em cada pagina ao inves de renderizar skeleton direto
- Envolver o conteudo principal de cada pagina (Dashboard, MetaAds, WhatsApp) com `SmoothLoader` que faz fade entre skeleton e conteudo
- Ajustar `AnimatePresence` no App.tsx: mudar transicao para `duration: 0.15` para ser mais rapida

## 5. Scrollbar vermelha

- Ja foi implementada no index.css (verificar se esta funcionando)

---

## Detalhes Tecnicos

### Arquivos a modificar:

1. `**src/pages/Dashboard.tsx**` - Adicionar graficos comparativos, aumentar cards, botao menor, regra visitas
2. `**src/pages/MetaAds.tsx**` - Aumentar cards, criativos em grid, espacamento entre secoes
3. `**src/components/whatsapp/ProjectReportConfigDialogNew.tsx**` - Modal maior e visual melhorado
4. `**src/App.tsx**` - Transicao mais rapida (duration 0.15)

### Sequencia:

1. Dashboard.tsx - graficos + espacamento + botao menor
2. MetaAds.tsx - cards + criativos grid + espacamento
3. ProjectReportConfigDialogNew.tsx - modal maior
4. App.tsx - transicao mais fluida