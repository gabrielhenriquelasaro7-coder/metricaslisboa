

# Plano: Instagram Social Media Dashboard via Meta Graph API

## Resumo

Sim, o Meta Graph API fornece dados completos do Instagram para contas Business/Creator. Vamos construir um dashboard completo de Social Media com metricas de conta, postagens individuais, demograficos e graficos de performance — tudo em PT-BR.

---

## O que o Meta Graph API fornece do Instagram

### Dados da Conta (IG User)
- `followers_count`, `follows_count`, `media_count`, `biography`, `name`, `profile_picture_url`

### Insights da Conta (periodo: day)
- `reach` — Alcance (contas unicas)
- `views` — Visualizacoes totais
- `accounts_engaged` — Contas engajadas
- `likes` — Curtidas totais
- `comments` — Comentarios totais
- `shares` — Compartilhamentos
- `saves` — Salvamentos
- `follows_and_unfollows` — Novos seguidores / perdidos
- `profile_views` — Visitas ao perfil
- `website_clicks` — Cliques no site
- `total_interactions` — Total de interacoes

### Demograficos da Audiencia (periodo: lifetime)
- `engaged_audience_demographics` — por age, city, country, gender
- `reached_audience_demographics` — por age, city, country, gender
- `follower_demographics` — por age, city, country, gender

### Dados por Midia (cada post/reel/story)
- Campos: `id`, `caption`, `media_type`, `media_url`, `thumbnail_url`, `timestamp`, `permalink`, `like_count`, `comments_count`
- Insights por midia: `reach`, `views`, `likes`, `comments`, `shares`, `saved`, `total_interactions`
- Para Reels: `plays`, `ig_reels_avg_watch_time`

### Limitacoes da API
- Token do Meta (Facebook Login for Business) com permissoes `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`
- Insights de conta: ultimos 30 dias (period=day)
- Demograficos: somente `lifetime`
- Dados podem ter delay de ate 48h
- Contas com menos de 100 seguidores nao retornam demograficos

---

## Arquitetura

### Banco de Dados (3 novas tabelas)

**`instagram_accounts`** — Configuracao por projeto
- `id`, `project_id`, `ig_user_id` (ID Instagram Business), `username`, `name`, `biography`, `profile_picture_url`, `followers_count`, `follows_count`, `media_count`, `website`, `last_sync_at`, `created_at`

**`instagram_media`** — Posts/Reels/Stories
- `id`, `project_id`, `ig_media_id`, `media_type` (IMAGE/VIDEO/CAROUSEL_ALBUM/REELS), `caption`, `media_url`, `thumbnail_url`, `permalink`, `timestamp`, `like_count`, `comments_count`, `reach`, `views`, `shares`, `saved`, `total_interactions`, `plays`, `avg_watch_time`, `synced_at`

**`instagram_insights_daily`** — Metricas diarias da conta
- `id`, `project_id`, `date`, `reach`, `views`, `accounts_engaged`, `likes`, `comments`, `shares`, `saves`, `follows`, `unfollows`, `profile_views`, `website_clicks`, `total_interactions`, `engaged_demographics` (JSONB), `reached_demographics` (JSONB), `follower_demographics` (JSONB)

### Edge Function: `instagram-sync`

Funcao que recebe `project_id` e executa:

1. **Buscar IG User ID** — via `facebook_page_id` do projeto: `GET /{page_id}?fields=instagram_business_account`
2. **Dados da Conta** — `GET /{ig_user_id}?fields=biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website`
3. **Insights Diarios (30 dias)** — `GET /{ig_user_id}/insights?metric=reach,views,accounts_engaged,likes,comments,shares,saves,follows_and_unfollows,profile_views,website_clicks,total_interactions&period=day&since={30d_ago}&until={today}`
4. **Demograficos** — `GET /{ig_user_id}/insights?metric=engaged_audience_demographics,reached_audience_demographics,follower_demographics&period=lifetime&metric_type=total_value`
5. **Midias (ultimas 50)** — `GET /{ig_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count&limit=50`
6. **Insights por midia** — Para cada midia: `GET /{media_id}/insights?metric=reach,views,likes,comments,shares,saved,total_interactions`

### Frontend: Pagina Instagram Completa

**Secao 1 — Cabecalho do Perfil**
- Foto de perfil, nome, bio, link do site
- Cards: Seguidores | Publicacoes | Seguindo

**Secao 2 — Cards de Metricas (grid 4x2)**
- Seguidores | Novos Seguidores | Alcance | Posts
- Curtidas | Comentarios | Salvos | Compartilhamentos
- Visualizacoes | Taxa de Engajamento

**Secao 3 — Grafico de Performance**
- Grafico de linhas (Recharts) com alcance, views, engajamento ao longo do periodo
- Seletor de metricas no grafico

**Secao 4 — Posts (Grid visual)**
- Filtros: Todos / Feed / Reels
- Ordenacao: Mais recentes, Mais alcance, Mais curtidas, Mais comentarios, Mais salvos, Mais compartilhamentos
- Grid de thumbnails com metricas resumidas (curtidas, comentarios, alcance)
- Click abre modal com detalhes completos do post

**Secao 5 — Modal Detalhes do Post**
- Imagem/video do post
- Legenda completa
- Metricas: Alcance, Views, Curtidas, Comentarios, Compartilhamentos, Salvos, Interacoes Totais
- Para Reels: Reproducoes, Tempo medio de visualizacao

**Secao 6 — Dados Demograficos**
- Graficos Donut: Genero e Idade
- Ranking: Principais Cidades
- Ranking: Principais Paises

**Secao 7 — Botao de Sincronizacao**
- Botao para sincronizar dados manualmente
- Indicador de ultima sincronizacao

---

## Detalhes Tecnicos

### Configuracao por Projeto
O campo `facebook_page_id` ja existe na tabela `projects`. A partir dele, a Edge Function descobre o `instagram_business_account` vinculado. Nao precisa de campo novo no projeto.

### Permissoes do Token
O token Meta (`META_ACCESS_TOKEN`) ja configurado no sistema precisa ter as permissoes:
- `instagram_basic`
- `instagram_manage_insights`
- `pages_read_engagement`
- `pages_show_list`

### Hook: `useInstagramData`
- Busca dados de `instagram_accounts`, `instagram_media`, `instagram_insights_daily`
- Calcula metricas derivadas (taxa de engajamento = interacoes / alcance)
- Agrega dados por periodo selecionado

### Arquivos a Criar/Editar
1. **Migracoes SQL** — 3 tabelas + RLS policies
2. `supabase/functions/instagram-sync/index.ts` — Edge Function
3. `src/hooks/useInstagramData.tsx` — Hook de dados
4. `src/pages/Instagram.tsx` — Pagina completa (substituir placeholder)
5. `src/components/instagram/InstagramProfileHeader.tsx` — Cabecalho
6. `src/components/instagram/InstagramMetricsGrid.tsx` — Grid de metricas
7. `src/components/instagram/InstagramPerformanceChart.tsx` — Grafico de linhas
8. `src/components/instagram/InstagramPostsGrid.tsx` — Grid de posts
9. `src/components/instagram/InstagramPostDetailModal.tsx` — Modal de detalhes
10. `src/components/instagram/InstagramDemographics.tsx` — Demograficos

