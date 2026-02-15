
# Reestruturacao: Separar Conteudo por Plataforma na Sidebar

## Visao Geral

Reorganizar toda a navegacao para que cada plataforma (Meta Ads, Google Ads, GA4) tenha sua propria secao acessada pela sidebar fixa. A Home vira um resumo geral e o dropdown de projetos fica no conteudo da pagina, nao na sidebar.

---

## O Que Muda

**Sidebar atual:** Logo > Dashboard > Meta > Google > Criativos > ... > Admin (invisivel?)

**Sidebar nova:** Logo > Home (icone casa) > Meta Ads > Google Ads > GA4 > Criativos > ... > Admin (sempre visivel)

**Dashboard atual:** Mostra metricas Meta Ads com dropdown de projeto

**Depois:**
- **Home** (`/dashboard`): Resumo geral - Top 3 criativos, Top campanhas, dados demograficos (Meta + Google combinados), com dropdown de projeto no topo
- **Meta Ads** (`/meta-ads`): Todo o conteudo atual do Dashboard (metricas, graficos, funil, demograficos) focado em Meta, com header "Meta Ads" igual ao print de referencia
- **Google Ads** (`/google-campaigns`): Layout igual ao Meta Ads mas com dados Google (ja existe, sera melhorado visualmente)
- **GA4** (`/analytics`): Pagina placeholder para futuro Google Analytics

---

## Mudancas Detalhadas

### 1. Sidebar (`TopSideBar.tsx`)
- Trocar icone Dashboard (LayoutDashboard) por icone Home (House/Home)
- Rota Home aponta para `/dashboard`
- Meta Ads aponta para `/meta-ads` (nova rota)
- Google Ads aponta para `/google-campaigns` (existente)
- Adicionar icone GA4 (BarChart3 ou icone customizado) apontando para `/analytics`
- Criativos continua em `/creatives`
- **Admin (Shield)**: Garantir que aparece SEMPRE para usuarios nao-guest, sem depender de `isTabHidden`
- Remover itens desabilitados (Bot, TrendingUp com opacity-30) para limpar

### 2. Nova pagina Home (`/dashboard` - reescrever `Dashboard.tsx`)
- Header com titulo "Home" + dropdown ClientSelector no topo
- Cards resumo: Top 3 criativos (imagem + metricas basicas)
- Top 5 campanhas (unificando Meta + Google)
- Mini cards de investimento total (Meta + Google somados)
- Graficos demograficos simplificados (genero, dispositivo)
- Layout clean e visual, como painel de controle

### 3. Nova pagina Meta Ads (`/meta-ads` - novo arquivo `MetaAds.tsx`)
- Mover TODO o conteudo atual de `Dashboard.tsx` para ca
- Header com logo Meta + titulo "Meta Ads" + dropdown de conta/campanha + DateRangePicker (igual print referencia)
- Metricas: Investimento, Resultados, Custo por Resultado, Cliques, Total cliques no link, Visualizacoes do site, Atendimentos
- Graficos de performance, funil, demograficos
- Tabela de campanhas com link para conjuntos/anuncios
- ClientSelector no header da pagina (nao na sidebar)

### 4. Melhorar Google Ads (`GoogleCampaigns.tsx`)
- Header com logo Google Ads + titulo "Google Ads" + conta dropdown + DateRangePicker (igual print referencia)
- Layout de metricas em grid 4 colunas (Investimento, Receita, ROAS, Custo por Conversao, Conversoes, Impressoes, Cliques, CTR, CPC, CPM, Share de Impressao, etc.)
- Mesma estetica visual do Meta Ads

### 5. Pagina GA4 placeholder (`Analytics.tsx`)
- Pagina simples com mensagem "Em breve" e icone GA4
- Preparada para futura integracao com Google Analytics

### 6. Criativos (`Creatives.tsx`)
- Adicionar filtro/tabs no topo: "Meta Ads" | "Google Ads" | "Todos"
- Filtrar criativos pela plataforma selecionada

### 7. Rotas (`App.tsx`)
- Adicionar rota `/meta-ads` -> `MetaAds`
- Adicionar rota `/analytics` -> `Analytics`
- `/dashboard` continua apontando para Home
- Redirecionar `/campaigns` para `/meta-ads` (compatibilidade)

---

## Detalhes Tecnicos

### Arquivos a criar:
- `src/pages/MetaAds.tsx` - pagina completa Meta Ads (conteudo migrado do Dashboard.tsx)
- `src/pages/Analytics.tsx` - placeholder GA4

### Arquivos a modificar:
- `src/components/layout/TopSideBar.tsx` - nova estrutura de icones
- `src/pages/Dashboard.tsx` - reescrever como Home resumo
- `src/pages/GoogleCampaigns.tsx` - melhorar layout visual
- `src/pages/Creatives.tsx` - adicionar filtro de plataforma
- `src/App.tsx` - novas rotas

### Icones na sidebar (ordem de cima para baixo):
```text
[V4 Logo]
---
Home (House)
Meta Ads (meta-icon.png)
Google Ads (google-ads-icon.png)
GA4 (BarChart3)
Criativos (ImageIcon)
Financeiro (DollarSign)
Historico (History)
WhatsApp (whatsapp-icon.png)
---
Sugestoes (Lightbulb)
Admin (Shield) -- SEMPRE visivel
Config (Settings)
Tema (Sun/Moon)
[Avatar]
```

### Sequencia de execucao:
1. Atualizar sidebar com novos icones e rotas
2. Criar pagina MetaAds.tsx (migrar conteudo do Dashboard)
3. Reescrever Dashboard.tsx como Home resumo
4. Criar pagina Analytics.tsx (placeholder)
5. Atualizar rotas no App.tsx
6. Melhorar visual do GoogleCampaigns.tsx
7. Adicionar filtro de plataforma nos Criativos
