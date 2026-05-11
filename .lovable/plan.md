# Relatório de Diagnóstico do Sistema

Análise feita em 11/05/2026 cobrindo banco de dados, RLS, edge functions, cron jobs, sincronizações e logs.

---

## CRÍTICO — Sincronizações quebradas há ~1 mês

**Sintoma:** A última métrica salva em `ads_daily_metrics` é de **13/04/2026**. Hoje é 11/05. O sistema está mostrando dados desatualizados em ~28 dias para 41 projetos.

**Causa raiz identificada nos `sync_logs`:**
- Todos os erros recentes são `Rate limit exceeded for trace ... Retry after 15-18s` da Meta.
- 27 projetos estão com `webhook_status = 'error'` (vs. 21 success / 3 active).
- O cron `daily-meta-sync` (05:00 UTC) dispara todos os projetos em paralelo, estoura o rate limit da Meta API e NÃO há retry/backoff. Quem falhou no dia 13/04 nunca mais foi reprocessado.

**Consequência:** dashboards, diagnóstico, relatórios PDF e WhatsApp estão entregando dados velhos sem aviso ao usuário.

**Recomendações:**
- Implementar backoff + retry honrando o `Retry after` da Meta dentro de `meta-ads-sync`/`scheduled-sync-parallel`.
- Serializar/limitar concorrência (ex.: 3-5 projetos por vez) no `scheduled-sync-parallel`.
- Job de "auto-heal" diário que pega projetos `webhook_status='error'` e re-tenta antes do sync regular.
- Banner no dashboard quando `last_sync_at` > 48h.

---

## CRÍTICO — Cron WhatsApp executando a cada minuto inutilmente

**Job:** `whatsapp-weekly-reports` com schedule `* * * * *` (a cada minuto, 24/7).

**Logs (últimos minutos):**
```
[WEEKLY-REPORT] Found 9 configs for today
[WEEKLY-REPORT] Not scheduled time for ... (scheduled: 08:00:00)
... 9x skipped por execução, todo minuto, todo dia
```

**Impacto:** ~12.960 invocações desperdiçadas por dia da edge function `whatsapp-weekly-report`, consumindo cota e log noise. Também faz 9 SELECTs no banco a cada minuto.

**Recomendação:** mudar schedule para `0 8 * * *` (uma vez ao dia, às 8:00 UTC) ou `*/15 8 * * *` se houver tolerância a fuso. A própria função já valida hora, mas o cron não precisa estar ligado o tempo todo.

---

## CRÍTICO — Segurança: tabela sem RLS

**Tabela:** `public.squad_members` está **com RLS DESABILITADO** mas tem políticas criadas (linter ERROR 1 e 2). Significa que QUALQUER usuário autenticado pode ler/modificar membros de qualquer squad. Como `squad_members` é usado pelo `can_view_project()` para decidir acesso a projetos, isso é um vetor de **escalonamento de privilégio**: um investidor pode se auto-adicionar a um squad e ganhar acesso a todos os projetos do squad.

**Fix imediato:**
```sql
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
```
E revisar as políticas existentes.

---

## ALTO — RLS policies permissivas (`USING (true)`)

O linter encontrou **17 policies** de UPDATE/DELETE/INSERT com `USING (true)` ou `WITH CHECK (true)`. Isso significa: qualquer usuário autenticado pode alterar/apagar essas linhas, não apenas as próprias. Precisamos identificar quais tabelas são (provavelmente `ads_daily_metrics`, `campaigns`, `period_metrics`, etc.) e restringir por `project_id` via `can_view_project()` ou `is_project_owner()`.

---

## ALTO — Funções SECURITY DEFINER expostas a anon

15 funções `SECURITY DEFINER` são executáveis por usuários **anônimos** (linter WARN 25-39) e mais 12 por authenticated indiscriminadamente. Inclui prováveis `has_role`, `can_view_project`, `is_master_user`, etc. Usuário anônimo pode chamar `can_see_all_projects(<uuid>)` e enumerar IDs.

**Fix:** `REVOKE EXECUTE ... FROM anon;` em todas exceto as que precisam (auth flow).

---

## MÉDIO — Buckets de storage públicos com listagem aberta

5 buckets públicos (`project-avatars`, `creative-images`, `creative-cache`, `project-logos`, `instagram-media`) permitem **listar todos os arquivos** (linter WARN 20-24). Vazamento potencial de logos/criativos de outros clientes via `storage.list()`.

**Fix:** restringir o policy de SELECT em `storage.objects` para essas buckets a operações por `name`/path conhecido, não por listagem.

---

## MÉDIO — Lógica de criação de projeto para Investidor

Conforme já corrigido em iterações anteriores, `useProjects.createProject` agora pega `auth.getUser()` no momento do insert. Confirmado no código atual. Porém:

- O `setProjects` otimista após o insert pode disparar **duplicata** quando o `INSERT realtime` chega depois (ambos têm o mesmo `project.id`, mas o realtime listener já tem dedup — OK).
- Se o investidor criar um projeto e adicionar a si mesmo na lista de `investidor_ids`, o `guest_project_access` é gravado, mas o próprio criador já tem `user_id = auth.uid()` no projeto, então fica redundante. Sem bug funcional.

---

## MÉDIO — Diagnóstico modo claro

Já tratado. A página `DiagnosticResults.tsx` e `DiagnosticWizard.tsx` ainda contêm classes hardcoded (`text-zinc-*`, `bg-zinc-950`, etc.) — funcionam por causa do override em `index.css`, mas não seguem o design system. Refator pendente para tokens semânticos.

---

## BAIXO — Inconsistências menores

1. **Edge function `predictive-analysis`** ainda está deployada e listada em `config.toml`, mas a feature foi descontinuada (memória `mem://features/predictive-analysis/deactivation`). Pode ser removida.
2. **`config.toml`** tem ~25 funções com `verify_jwt = false` — algumas (`whatsapp-send`, `instagram-publish`, `invite-guest`, `crm-*`) deveriam exigir JWT, pois alteram dados sensíveis.
3. **`handle_new_user_role`** seta cargo padrão `'gestor'` mas `get_user_cargo` default é `'membro'`. Inconsistência.
4. **Cache global de projetos** em `useProjects` (`globalProjectsCache`) usa `let` no escopo do módulo — quebra em hot reload e SSR; vaza estado entre logins se o reset effect não rodar antes da primeira `fetchProjects`.
5. **Sem logs PostgREST/Auth** com erros nos últimos 100 — bom sinal de saúde de DB/auth runtime.

---

## Resumo prioritário

| Prioridade | Item | Esforço |
|---|---|---|
| P0 | Habilitar RLS em `squad_members` | 5 min |
| P0 | Reativar sincronização Meta (rate limit + retry) | 2-3 h |
| P0 | Corrigir cron WhatsApp para `0 8 * * *` | 5 min |
| P1 | Restringir 17 policies `USING (true)` | 1-2 h |
| P1 | REVOKE EXECUTE em SECURITY DEFINER para `anon` | 30 min |
| P2 | Restringir listagem de buckets públicos | 1 h |
| P2 | Adicionar `verify_jwt = true` em funções sensíveis | 30 min |
| P3 | Banner de "dados desatualizados" no dashboard | 1 h |
| P3 | Refator Diagnostic para tokens semânticos | 2 h |
| P3 | Remover edge function `predictive-analysis` deprecada | 10 min |

Quer que eu implemente os P0 agora (RLS de squad_members + cron do WhatsApp + retry/backoff do Meta sync)?
