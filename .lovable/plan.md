

# Plano: Corrigir Google Ads + Import Simultaneo Meta/Google

## Problemas Identificados

1. **Google Ads quebrando**: A versao v19 da API foi desativada pelo Google em 11/fev/2026. O erro "UNSUPPORTED_VERSION" confirma isso. Precisamos atualizar para **v23** (a mais recente, lancada em 28/jan/2026).

2. **Import nao e simultaneo**: Quando um projeto novo e criado, so o Meta e importado. Se tiver Google Customer ID, o Google deveria rodar ao mesmo tempo.

3. **Video do Meta**: Nao consome tokens. E apenas uma URL que a API do Meta retorna. Vamos adicionar suporte a reproducao de video nos criativos.

## Mudancas Planejadas

### 1. Atualizar Google Ads API de v19 para v23

- **Arquivo**: `supabase/functions/google-ads-sync/index.ts`
- Trocar a URL de `v19` para `v23` na funcao `executeGoogleAdsQuery`
- Verificar se ha campos novos/removidos na v23 (geralmente retrocompativel)

### 2. Import Simultaneo (Meta + Google em paralelo)

- **Arquivo**: `src/components/projects/CreateProjectDialog.tsx`
- Ao criar projeto, se tiver `google_customer_id` preenchido, disparar `Promise.all` com:
  - `meta-ads-sync` (ja existe)
  - `google-ads-sync` (novo)
- Ambos rodam ao mesmo tempo, sem esperar um pelo outro

- **Arquivo**: `src/components/projects/EditProjectDialog.tsx`
- Ao salvar com novo `google_customer_id`, disparar sync do Google automaticamente (ja implementado parcialmente)

### 3. Sync Agendado Tambem em Paralelo

- **Arquivo**: `supabase/functions/scheduled-sync-parallel/index.ts`
- Apos o sync do Meta, verificar se o projeto tem `google_customer_id`
- Se sim, chamar `google-ads-sync` em paralelo dentro do mesmo batch

### 4. Hierarquia de Dados Google Ads

A estrutura ja existe e e identica ao Meta:

```text
Conta (Customer ID)
  └── Campanhas (google_campaigns)
       └── Grupos de Anuncios (google_ad_groups)
            └── Anuncios (google_ads)
                 └── Metricas Diarias (google_ads_daily_metrics)
```

## Detalhes Tecnicos

### Atualizacao da API (v19 -> v23)

```typescript
// ANTES (quebrado)
const url = `https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:searchStream`;

// DEPOIS (corrigido)
const url = `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`;
```

### Import Simultaneo no CreateProject

```typescript
// Disparar ambos ao mesmo tempo
const syncPromises = [];

// Meta sempre roda
syncPromises.push(
  supabase.functions.invoke('meta-ads-sync', { body: { project_id, ... } })
);

// Google roda se tiver customer_id
if (google_customer_id) {
  syncPromises.push(
    supabase.functions.invoke('google-ads-sync', { body: { projectId, syncType: 'full', days: 90 } })
  );
}

await Promise.all(syncPromises);
```

### Sync Agendado Paralelo

Na funcao `scheduled-sync-parallel`, apos o sync Meta de cada projeto, adicionar chamada ao Google Ads se o projeto tiver `google_customer_id` configurado. Ambos rodam em `Promise.all` dentro do mesmo batch.

## Resumo de Arquivos a Editar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/google-ads-sync/index.ts` | v19 -> v23 |
| `src/components/projects/CreateProjectDialog.tsx` | Import simultaneo Meta+Google |
| `src/components/projects/EditProjectDialog.tsx` | Manter auto-sync ao adicionar Google ID |
| `supabase/functions/scheduled-sync-parallel/index.ts` | Incluir Google no sync diario |

