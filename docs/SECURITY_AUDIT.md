# Auditoria de Segurança / RLS — 2026-05-11

Snapshot do `supabase linter` após o hardening: **18 warnings restantes**, todos
classificados abaixo. Resultado dos testes automatizados:

- `supabase/functions/_tests/rls_security_test.ts` — **18/18 ok** (anon não lê
  nenhuma tabela tenant, não escreve em `projects` / `campaigns` /
  `ads_daily_metrics` / `user_roles`).
- `supabase/functions/scheduled-sync-parallel/_filter_test.ts` — **9/9 ok**
  (retry_pending respeita `next_retry_at` e `will_retry`, sem loop).
- `supabase/functions/meta-ads-sync/_retry_helpers_test.ts` — **12/12 ok**.

## Classificação dos 18 warnings

### A) Buckets públicos com listing aberto — 5 warnings (POR DESIGN)

| # | Bucket | Por quê é público | Risco real |
|---|--------|------|---|
| 1 | `project-avatars` | Logos exibidos no app público | Baixo — só metadata pública |
| 2 | `creative-images` | Thumbnails de criativos do Meta exibidos no UI | Baixo — já são públicos no CDN do Meta |
| 3 | `creative-cache` | Cache de imagens de criativos | Baixo — derivado de fonte pública |
| 4 | `project-logos` | Logos exibidos sem auth no onboarding | Baixo |
| 5 | `instagram-media` | Mídias do Instagram (já públicas na origem) | Baixo |

**Decisão:** manter como `Public = true`. **Mitigação aplicável** (opcional):
restringir a policy `storage.objects SELECT` por `bucket_id` + prefixo
`projectId/...` para evitar enumeration. Hoje qualquer um com a URL do CDN já
acessa o arquivo, então o ganho é apenas anti-listagem.

### B) SECURITY DEFINER chamáveis por authenticated — 12 warnings (POR DESIGN)

São as funções de autorização usadas dentro das policies RLS — `has_role`,
`has_cargo`, `can_view_project`, `can_see_all_projects`, `is_master_user`,
`get_user_cargo`, `get_user_squad_ids`, `has_admin_access`,
`has_project_admin_access`, `is_project_owner`, `user_has_project_access`,
`needs_password_change`.

Elas **precisam** ser chamáveis pelo role `authenticated` porque o próprio
Postgres invoca durante a avaliação das policies. Testamos via testes RLS que
nenhuma delas vaza dado: o que retornam é apenas um boolean derivado da
identidade do chamador (`auth.uid()`).

**Decisão:** aceitar. Já revogamos `EXECUTE` para `anon` e `PUBLIC` na migração
anterior. Nada a fazer.

### C) Leaked Password Protection desativado — 1 warning (AÇÃO MANUAL)

Setting do Supabase Auth (HaveIBeenPwned). Não é configurável via SQL/Cloud
tooling — precisa ser ativado pelo usuário em **Backend → Auth → Password
protection** (uma alavanca). Recomendo ativar.

## Pontos de atenção que o linter NÃO captura

| Tabela | Situação | Recomendação |
|---|---|---|
| `account_goals` | INSERT/UPDATE/DELETE com `roles: {public}` (deveria ser `authenticated`) | Trocar `to public` por `to authenticated` em todas policies — funcional não muda, mas reduz superfície. |
| `chart_preferences`, `clarity_projects`, `campaign_goals`, `anomaly_alert_config` | Mesmo padrão (`{public}` em vez de `{authenticated}`) | Idem |
| `guest_invitations` | `temp_password` armazenado em plaintext | Remover coluna após o convidado trocar a senha (cron de limpeza). |
| `crm_connections.access_token / refresh_token / api_key` | Tokens em plaintext na tabela | Mover para Vault / pgsodium ou cifrar com KMS. **Risco médio.** |
| `admin_access_grants` | Sem coluna `revoked_at` mas `has_admin_access` referencia. | Confirmar consistência do schema. |
| Policies usando `auth.uid()` direto em subquery | OK mas preferir `(select auth.uid())` para perf em larga escala | Nice-to-have. |

## Plano sugerido (priorizado)

1. **P1 — Tokens CRM em plaintext (`crm_connections`):** mover para
   `vault.create_secret` ou cifrar com chave do projeto. Único risco real de
   exfiltração nesta auditoria.
2. **P2 — Trocar `to public` por `to authenticated`** nas 5 tabelas listadas
   (cosmético, mas elimina ambiguidade).
3. **P3 — Limpar `guest_invitations.temp_password`** após uso (cron diário).
4. **P3 — Ativar Leaked Password Protection** (1 clique).
5. **P4 — Storage:** opcional, restringir SELECT por prefixo de projeto se
   anti-enum importar.

Nenhum dos 18 warnings restantes representa exposição de dado de tenant. A
suite de testes RLS valida isso continuamente.
