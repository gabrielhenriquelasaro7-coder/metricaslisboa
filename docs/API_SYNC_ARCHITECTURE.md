# Arquitetura de Sincronização Meta Ads

## Visão Geral

O sistema sincroniza dados do Meta Ads (Facebook/Instagram) para um banco de dados Supabase usando Edge Functions.

---

## Fluxo Principal

```
1. Usuário cria projeto → sync-webhook
2. sync-webhook → import-month-by-month (mês a mês)
3. import-month-by-month → meta-ads-sync (quinzena por quinzena)
4. meta-ads-sync → Meta Graph API → Supabase DB
```

---

## Edge Functions

### 1. `meta-ads-sync` (Principal)

**Endpoint:** `POST /functions/v1/meta-ads-sync`

**Request Body:**
```json
{
  "project_id": "uuid",
  "ad_account_id": "act_1234567890",
  "access_token": "opcional - usa META_ACCESS_TOKEN se não informado",
  "time_range": {
    "since": "2025-01-01",
    "until": "2025-01-15"
  },
  "date_preset": "last_7d | last_30d | this_month",
  "light_sync": true,
  "skip_image_cache": true,
  "syncOnly": "campaigns | adsets | ads | creatives"
}
```

**Parâmetros:**
- `project_id` (required): UUID do projeto
- `ad_account_id` (required): ID da conta de anúncios (formato: `act_XXXXXXXXXX`)
- `time_range`: Período específico para buscar insights
- `date_preset`: Preset de período (alternativa ao time_range)
- `light_sync`: Se true, busca só estrutura + métricas básicas (sem imagens HD)
- `skip_image_cache`: Se true, não faz cache de imagens
- `syncOnly`: Limita a sincronização a um tipo de entidade

**Response:**
```json
{
  "success": true,
  "summary": {
    "records": 1500,
    "totalSpend": 5000.00,
    "totalConversions": 150,
    "campaigns": 50,
    "adsets": 200,
    "ads": 500
  }
}
```

---

### 2. `import-month-by-month` (Orquestrador)

**Endpoint:** `POST /functions/v1/import-month-by-month`

**Request Body:**
```json
{
  "project_id": "uuid",
  "year": 2025,
  "month": 1,
  "continue_chain": true,
  "ad_account_id": "act_1234567890",
  "max_month": 12,
  "fetch_creatives_only": false
}
```

**Lógica:**
1. Divide o mês em 2 quinzenas (1-15 e 16-31)
2. Chama `meta-ads-sync` para cada quinzena
3. Delay de 8 segundos entre quinzenas
4. Se `continue_chain=true`, encadeia próximo mês
5. Ao final, chama com `fetch_creatives_only=true` para HD

**Delays dinâmicos (baseado em qtd de ads):**
- > 500 ads: 15s entre meses
- > 300 ads: 10s
- > 100 ads: 5s
- ≤ 100 ads: 3s

---

## Chamadas à Meta Graph API

### Versão: `v22.0`

### Base URL: `https://graph.facebook.com/v22.0`

---

### 1. Buscar Campanhas

```
GET /{ad_account_id}/campaigns
  ?fields=id,name,status,objective,daily_budget,lifetime_budget
  &limit=500
  &effective_status=["ACTIVE","PAUSED","ARCHIVED",...]
  &access_token={token}
```

---

### 2. Buscar Conjuntos de Anúncios

```
GET /{ad_account_id}/adsets
  ?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,promoted_object
  &limit=500
  &effective_status=[...]
  &access_token={token}
```

---

### 3. Buscar Anúncios (com criativos)

**Light Sync:**
```
GET /{ad_account_id}/ads
  ?fields=id,name,status,adset_id,campaign_id,creative{id,object_story_spec,asset_feed_spec,thumbnail_url,body,title,call_to_action_type}
  &limit=200
  &effective_status=[...]
  &access_token={token}
```

**Full Sync (com imagem):**
```
GET /{ad_account_id}/ads
  ?fields=id,name,status,adset_id,campaign_id,creative{id,image_hash,object_story_spec,asset_feed_spec,thumbnail_url,image_url,body,title,call_to_action_type}
  &limit=200
  &effective_status=[...]
  &access_token={token}
```

---

### 4. Buscar Insights (Métricas)

```
GET /{ad_account_id}/insights
  ?level=ad
  &time_range={"since":"2025-01-01","until":"2025-01-15"}
  &fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,
          spend,impressions,clicks,reach,frequency,ctr,cpm,cpc,
          actions,action_values,conversions,conversion_values,
          cost_per_action_type,video_p100_watched_actions
  &limit=500
  &access_token={token}
```

**Campos de actions importantes:**
- `lead`: Leads gerados
- `purchase`: Compras
- `initiate_checkout`: Checkout iniciado
- `onsite_conversion.messaging_first_reply`: Respostas no Messenger
- `ig_profile_visit`: Visitas ao perfil Instagram

---

### 5. Buscar Imagens HD

```
GET /{ad_account_id}/adimages
  ?hashes=["hash1","hash2",...]
  &fields=hash,url,url_1024
  &access_token={token}
```

---

### 6. Buscar Thumbnail HD do Criativo

```
GET /{creative_id}
  ?fields=thumbnail_url
  &thumbnail_width=1080
  &thumbnail_height=1080
  &access_token={token}
```

---

## Tratamento de Erros

### Erro 1504018 - Request Expired
**Causa:** Query muito grande (muitos ads × muitos dias)
**Solução:** Dividir em períodos menores (quinzenas → semanas → dias)

### Erro 80004 - Rate Limit
**Causa:** Muitas chamadas à API
**Solução:** Aumentar delays entre chamadas (30-60s para contas grandes)

### Erro 17 - User Request Limit
**Causa:** Limite de requisições por usuário
**Solução:** Retry com backoff exponencial (5s, 10s, 20s)

### Erro 190 - Token Expired
**Causa:** Access token inválido ou expirado
**Solução:** Renovar token

---

## Estrutura do Banco de Dados

### Tabela: `ads_daily_metrics`
```sql
- id: UUID
- project_id: UUID
- date: DATE
- ad_id: TEXT
- ad_name: TEXT
- adset_id: TEXT
- adset_name: TEXT
- campaign_id: TEXT
- campaign_name: TEXT
- spend: NUMERIC
- impressions: INTEGER
- clicks: INTEGER
- reach: INTEGER
- conversions: INTEGER
- conversion_value: NUMERIC
- ctr: NUMERIC
- cpc: NUMERIC
- cpm: NUMERIC
- roas: NUMERIC
- leads_count: INTEGER
- purchases_count: INTEGER
- messaging_replies: INTEGER
- profile_visits: INTEGER
- synced_at: TIMESTAMP
```

### Tabela: `campaigns`
```sql
- id: TEXT (Meta ID)
- project_id: UUID
- name: TEXT
- status: TEXT
- objective: TEXT
- daily_budget: NUMERIC
- lifetime_budget: NUMERIC
- spend, impressions, clicks, reach, conversions, etc.
```

### Tabela: `ad_sets`
```sql
- id: TEXT (Meta ID)
- project_id: UUID
- campaign_id: TEXT
- name: TEXT
- status: TEXT
- targeting: JSONB
- daily_budget, lifetime_budget, etc.
```

### Tabela: `ads`
```sql
- id: TEXT (Meta ID)
- project_id: UUID
- campaign_id: TEXT
- ad_set_id: TEXT
- name: TEXT
- status: TEXT
- creative_id: TEXT
- creative_thumbnail: TEXT
- creative_image_url: TEXT
- cached_image_url: TEXT
- headline: TEXT
- primary_text: TEXT
- cta: TEXT
```

---

## Secrets Necessários

| Nome | Descrição |
|------|-----------|
| `META_ACCESS_TOKEN` | Token de acesso à Graph API (longa duração) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço do Supabase |

---

## Problema Atual: Krum

**Conta:** `act_1584577581723228`
**Tamanho:** 760 ads, 312 ad sets, 118 campanhas

**Erro:** `1504018 - Sua solicitação expirou`
- Acontece mesmo com quinzenas
- A API do Meta não consegue processar tantos ads de uma vez

**Solução proposta:**
1. Dividir em semanas (7 dias) ao invés de quinzenas
2. Ou dividir por campanha individualmente
3. Aumentar delays entre chamadas para 30-60s

---

## Como Testar Manualmente

```bash
# Testar sync de um período específico
curl -X POST https://chxetrmrupvxqbuyjvph.supabase.co/functions/v1/meta-ads-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}" \
  -d '{
    "project_id": "uuid-do-projeto",
    "ad_account_id": "act_1584577581723228",
    "time_range": {"since": "2025-01-01", "until": "2025-01-07"},
    "light_sync": true
  }'
```

---

## Fluxo Visual

```
┌─────────────────┐
│  Criar Projeto  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  sync-webhook   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  import-month-by-month      │
│  (divide em quinzenas)      │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ 1-15   │ │ 16-31  │
│ dias   │ │ dias   │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌─────────────────┐
│  meta-ads-sync  │
└────────┬────────┘
         │
    ┌────┴────────────────┐
    ▼                     ▼
┌──────────┐      ┌───────────────┐
│ Entities │      │   Insights    │
│ (Struct) │      │  (Metrics)    │
└────┬─────┘      └───────┬───────┘
     │                    │
     ▼                    ▼
┌─────────────────────────────────┐
│         Supabase DB             │
│  campaigns, ad_sets, ads,       │
│  ads_daily_metrics              │
└─────────────────────────────────┘
```
