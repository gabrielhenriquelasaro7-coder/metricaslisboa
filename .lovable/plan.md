

## Plano: Tratamento visual para travas "Sem Dados" + Opção "Não se Aplica"

### Problema
Algumas travas (ex: Retenção para produtos high-ticket sem recompra) ficam como "SEM DADOS" mas isso não significa que o dado está faltando — o estágio simplesmente não se aplica ao modelo de negócio. Falta diferenciação visual e orientação ao usuário.

### Solução em 3 partes

**1. Adicionar opção "Não se aplica" no Wizard (DiagnosticWizard.tsx)**
- Em cada trava do funil, adicionar um checkbox/toggle: "Esta trava não se aplica ao meu negócio"
- Quando marcada, os campos da trava ficam desabilitados e o valor salvo no `funnelData` seria algo como `{ _nao_aplica: true }`
- PDV já ignora Trava 05 automaticamente — estender essa lógica para qualquer trava que o usuário marque

**2. Novo status visual "NÃO SE APLICA" nos Results (DiagnosticResults.tsx)**
- Adicionar status `nao_aplica` ao `STATUS_LABELS`: tag "N/A" com cor cinza/azul neutro
- O slider mostra uma barra cinza sem bolinha (similar a `sem_dados` mas com estilo distinto)
- Mensagem compacta embaixo: "Não aplicável a este modelo"

**3. Alerta compacto para travas "SEM DADOS" reais (DiagnosticResults.tsx)**
- Nas travas com status `sem_dados` (que NÃO foram marcadas como N/A), exibir uma linha de alerta pequena abaixo do slider:
  - Ícone `AlertTriangle` + texto: "Dados não preenchidos — preencha para análise mais precisa"
  - Cor amber/amarela, `text-[11px]`
- Isso diferencia claramente "falta dado" (precisa preencher) de "não se aplica" (ok ignorar)

### Mudanças nos tipos (types/diagnostic.ts)
- Adicionar campo opcional `_nao_aplica?: boolean` ao `FunnelTravaData`

### Fluxo de dados
- Wizard marca `_nao_aplica: true` no `funnelData.travaXX`
- Prompt da IA recebe essa informação e trata como "não aplicável" (não marca como cegueira)
- Results verifica se `funnelData.travaXX._nao_aplica === true` → renderiza como N/A em vez de SEM DADOS

### Arquivos modificados
1. `src/types/diagnostic.ts` — campo `_nao_aplica` no FunnelTravaData
2. `src/pages/diagnostic/DiagnosticWizard.tsx` — toggle por trava + lógica de disable
3. `src/pages/diagnostic/DiagnosticResults.tsx` — status N/A + alerta amber em SEM DADOS
4. `supabase/functions/diagnostic-ai-analysis/index.ts` — incluir no prompt que travas marcadas N/A devem ser ignoradas

