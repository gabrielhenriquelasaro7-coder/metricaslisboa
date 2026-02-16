

# Corrigir Google Ads Sync + Redesign da Pagina

## 1. Corrigir Erro do Sync (PAGE_SIZE_NOT_SUPPORTED)

O erro e claro: a API v23 do Google Ads no endpoint `search` nao aceita `pageSize`. O campo precisa ser removido do body da requisicao.

**Arquivo**: `supabase/functions/google-ads-sync/index.ts`
- Remover `pageSize: 10000` do body da funcao `executeGoogleAdsQuery`
- A API retorna automaticamente ate 10.000 resultados por pagina

## 2. Redesign da Pagina Google Ads (Hierarquia Unica, Sem Abas)

Atualmente a pagina usa `Tabs` (Campanhas | Palavras-chave | Demograficos). O usuario quer tudo na mesma pagina em sequencia vertical, igual ao Meta Ads.

**Arquivo**: `src/pages/GoogleCampaigns.tsx`

Nova estrutura hierarquica (scroll unico):

```text
[Header + ClientSelector + DateRangePicker]
[Cards de Metricas Compactos - 6 SparklineCards]
[Campanhas Expandiveis]
   └── Grupo de Anuncio (com status VERDE quando ENABLED)
        └── Anuncios individuais (com headlines, descriptions, URLs)
[Palavras-chave - Tabela compacta]
[Demograficos - 3 cards lado a lado (Idade, Genero, Dispositivo)]
```

### Mudancas especificas na UI:

- **Remover Tabs completamente** - tudo numa unica pagina
- **Status do Grupo de Anuncio**: quando `ENABLED`, badge verde (`bg-metric-positive text-white`) em vez de cinza
- **Anuncios visiveis**: quando expandir o grupo, os anuncios aparecem com headlines, descriptions e URLs
- **Formato identico ao Meta**: Campanha como botao expansivel com chevron, metricas inline, sub-nivel para grupos e anuncios
- **Secao de Palavras-chave**: abaixo das campanhas, sem aba separada
- **Secao de Demograficos**: abaixo das palavras-chave, grid de 3 colunas

## 3. Detalhes Tecnicos

### Edge Function Fix (linha 73):
```typescript
// ANTES (quebrado)
const body: any = { query, pageSize: 10000 };

// DEPOIS (corrigido)  
const body: any = { query };
```

### Status Badge do Ad Group:
```typescript
// ANTES (sempre cinza)
<Badge variant="secondary">

// DEPOIS (verde quando ativo)
<Badge className={cn(
  "text-[10px]",
  ag.status === 'ENABLED' ? "bg-metric-positive text-white" : "bg-secondary text-muted-foreground"
)}>
```

### Layout Hierarquico (sem Tabs):
- Campanhas: botao expansivel com ChevronDown/Right + nome + gasto + conversoes
- Ao expandir campanha: grid de metricas + lista de Ad Groups
- Ao expandir Ad Group: grid de metricas + lista de Ads com detalhes
- Palavras-chave: secao separada abaixo com titulo e tabela
- Demograficos: secao separada abaixo com 3 cards

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/google-ads-sync/index.ts` | Remover `pageSize` |
| `src/pages/GoogleCampaigns.tsx` | Remover Tabs, layout hierarquico unico, status verde |

