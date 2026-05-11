
## Problemas identificados

### 1. `/diagnostico` → ao abrir o resultado de um projeto, aparecem dados antigos

**Causa raiz**
Em `src/pages/DiagnosticTOC.tsx`, o card "Abrir" injeta `currentProject` diretamente do array `projects`, que é montado em `fetchReports()` espalhando `r.data` (o snapshot JSONB salvo em `diagnostic_reports.data`) e sobrescrevendo apenas `id/projectId/month/year/updatedAt`. Resultado:

- O `id` interno passa a ser o `id` do registro do report (não o `systemProjectId`).
- Os bowtie/economics/market exibidos são o snapshot da última vez que o wizard salvou — não refletem dados atuais (CRM, ads_daily_metrics) do projeto.
- Quando o usuário edita o projeto no Wizard e volta, o `setCurrentProject` recebe o objeto recém-salvo, mas o `fetchReports()` é chamado em paralelo e pode sobrescrever silenciosamente.

**Correção**
- Em `DiagnosticTOC.tsx`:
  - Garantir que `currentProject` carregado da lista preserve `systemProjectId` (atualmente só salva quando o projeto é novo no `handleStartNew`). Ler/persistir `system_project_id` como coluna explícita ou guardar dentro de `data.systemProjectId` consistentemente, e mapear no `fetchReports` (`systemProjectId: reportData.systemProjectId || r.project_id`).
  - Após `saveProject`, não chamar `fetchReports` em paralelo com `setMode('results')` — esperar o upsert e refazer a leitura **antes** de trocar de modo, e setar `currentProject` com o registro fresco do banco.
  - Quando abrir um diagnóstico existente, mostrar timestamp do último update (`updatedAt`) e oferecer botão "Atualizar com dados atuais" que reabre o Wizard pré-preenchido.

### 2. Senha de admin "12345678" não autentica

**Causa raiz provável**
Em `src/hooks/useAdminAuth.tsx` (`verifyPassword`), o select usa `.from('system_settings' as any).select('value').eq('key','admin_password').single()`. A RLS permite leitura para `authenticated`, e o valor confirmado no banco é `12345678`. Os cenários que quebram:

1. `localStorage` tem uma sessão `admin_authenticated_session` corrompida ou de outro usuário, que dispara o `catch` silencioso e mantém `isAdminAuthenticated = false`.
2. `single()` retorna erro (multiple rows / nenhuma row) e o `try/catch` engole sem feedback.
3. Comparação direta com `===` pode falhar se o valor armazenado tiver espaço em branco/quebra de linha.

**Correção**
- Em `useAdminAuth.tsx > verifyPassword`:
  - Trocar `.single()` por `.maybeSingle()` e logar o erro real no console.
  - Comparar com `String(data.value).trim() === password.trim()`.
  - Quando falhar, retornar mensagem específica ("senha incorreta" vs "erro ao consultar configuração") para o componente `AdminPasswordGate` exibir o motivo real.
- Adicionar limpeza defensiva do `localStorage.admin_authenticated_session` em caso de JSON inválido.
- Resetar a senha no banco para `12345678` (TRIM/idempotente) via migração para garantir que não há caractere invisível.

### Validação
- Abrir `/diagnostico`, criar/editar um projeto, salvar e confirmar que o resultado exibe os valores recém-salvos (não snapshot antigo).
- Logar fora, logar de volta, ir em `/admin`, digitar `12345678` → deve entrar. Se falhar, console mostrará o motivo exato.

### Observações
- Não vou refatorar o visual do `DiagnosticResults` (ele usa cores hardcoded `bg-zinc-900` em vez de tokens) porque você marcou o problema como "dados", não visual. Se quiser que eu também migre para tokens semânticos do design system, me avise — é um trabalho separado.
- Sobre "muitos outros erros": preciso de exemplos específicos (mensagens, prints, rotas) para tratar — abre uma issue separada listando os principais e eu ataco em sequência.
