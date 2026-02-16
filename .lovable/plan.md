
# Plano de Melhorias: Carregamento, Home, Meta Ads, WhatsApp e Sidebar

## 1. Tela de Carregamento entre abas (Sidebar travando)

**Problema**: Ao clicar em outra aba da sidebar, a tela pisca e os botoes da sidebar demoram para responder. O `AnimatePresence mode="wait"` no App.tsx bloqueia a renderizacao da nova pagina ate a animacao de saida terminar.

**Solucao**:
- Mudar `AnimatePresence mode="wait"` para `mode="popLayout"` ou remover o `exit` animation no App.tsx, permitindo que a nova pagina comece a renderizar imediatamente
- Reduzir `duration` de 0.15 para 0.1 na transicao
- Cada pagina principal (Dashboard, MetaAds, WhatsApp) ja usa `SmoothLoader` - garantir que o skeleton apareca imediatamente enquanto os dados carregam
- Adicionar `will-change: opacity` no motion.div para otimizar a GPU

## 2. Home (Dashboard.tsx) - Mais conteudo

### Top Conjuntos de Anuncios
- Adicionar secao "Top 5 Conjuntos" logo apos Top Campanhas
- Listar os ad sets (de `useMetaAdsData`) ordenados por gasto, mostrando nome, gasto e conversoes

### Dados Demograficos separados por canal (Meta vs Google)
- Na secao de Demographics, adicionar tabs ou labels "Meta" e "Google" para separar visualmente os dados de cada plataforma
- Como os dados demograficos atuais vem so do Meta, deixar claro com icone/label que sao dados Meta e reservar espaco para Google quando disponivel

### Espacamento dos icones Meta/Google nos cards
- No componente `PlatformBreakdown`, aumentar `gap-0.5` para `gap-1.5` entre o icone e o valor, e `gap-2` para `gap-3` entre Meta e Google

## 3. Meta Ads - Correcoes pendentes

### Comparacao de periodos - remover porcentagem de investimento
- No componente `PeriodComparison.tsx`, localizar a exibicao de "% investimento" e remover/ocultar essa metrica especifica (a porcentagem de variacao de investimento mostrada na imagem-429)

### Cards de Resultado menores
- Reduzir o tamanho dos `SparklineCard` nos grids de resultado: diminuir padding interno e font sizes
- Mudar de `gap-2.5 sm:gap-3` para `gap-2 sm:gap-2.5`

### Criativo abre em modal (nao navega para outra pagina)
- No grid de criativos dentro do ad set expandido, ao clicar no criativo, abrir um **Dialog/Modal** na mesma pagina em vez de navegar para `/creative/:id`
- O modal mostrara: imagem grande, nome, ID do criativo, gasto, conversoes, CTR, CPC, CPM e graficos de performance diaria (reutilizar `CustomizableChart`)
- Remover a barra de frequencia que aparece atualmente no criativo

### Card Saldo da Meta menor
- Reduzir padding e font sizes no `AccountBalanceCard.tsx` para ficar mais compacto

## 4. WhatsApp - Correcao da tela "Selecione um projeto"

**Problema**: Ao clicar em WhatsApp sem projeto selecionado, aparece tela vazia com "Selecione um projeto primeiro" (imagem-430).

**Solucao**:
- Quando nao ha projeto selecionado, usar o primeiro projeto ativo automaticamente (ja tem fallback `projects[0]`, verificar se `projects` ja carregou)
- Garantir que o `loading` state cubra o periodo ate `projects` estar carregado, evitando o flash da tela vazia

### Modal WhatsApp - barra de rolagem
- Adicionar `overflow-y-auto` nas tabs GT e Account dentro do `ProjectReportConfigDialogNew`
- O container interno ja tem `overflow-y-auto` (linha 98), verificar se esta funcionando corretamente em ambas as tabs

## 5. Detalhes Tecnicos

### Arquivos a modificar:
1. **`src/App.tsx`** - Remover mode="wait" ou trocar para transicao sem bloqueio
2. **`src/pages/Dashboard.tsx`** - Adicionar Top Conjuntos, separar demograficos por canal, aumentar gap nos icones Meta/Google
3. **`src/pages/MetaAds.tsx`** - Modal para criativo (Dialog), remover frequencia, diminuir SparklineCards e AccountBalance
4. **`src/components/dashboard/PeriodComparison.tsx`** - Remover porcentagem de investimento
5. **`src/components/dashboard/AccountBalanceCard.tsx`** - Reduzir tamanho
6. **`src/pages/WhatsApp.tsx`** - Corrigir loading state para evitar tela "Selecione projeto"
7. **`src/components/whatsapp/ProjectReportConfigDialogNew.tsx`** - Garantir scroll nas tabs

### Sequencia de implementacao:
1. App.tsx - transicao sem bloqueio (resolve carregamento entre abas)
2. WhatsApp.tsx - corrigir tela vazia
3. Dashboard.tsx - top conjuntos + demograficos por canal + gap icones
4. MetaAds.tsx - modal criativo + cards menores
5. PeriodComparison.tsx - remover % investimento
6. AccountBalanceCard.tsx - compactar
