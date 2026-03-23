
Objetivo
Corrigir definitivamente o mapeamento das travas para ficar canônico em todo o sistema: **Trava 01 = topo (Alcance/Impressões)**, **Trava 07 = fundo (Retenção/Recompra)**, com análise TOC em **07→01** e exibição consistente de **número + estágio + categoria**.

Plano de implementação

1) Centralizar o mapeamento canônico (fonte única)
- Criar um mapeamento único por modelo de negócio (inside_sales, ecommerce, pdv) com:
  - `travaId` (01..07),
  - `estagio`,
  - `nome_curto`,
  - `metricas`,
  - `categoria` (ATENÇÃO / INTERESSE / COMPROMISSO / RETENÇÃO),
  - ordem de análise `07→01`.
- Incluir regra especial PDV: **Trava 05 = não se aplica**.

2) Corrigir o Wizard (entrada de dados)
- Ajustar `getTravaConfigs` para o novo padrão:
  - Inside Sales: 01 Impressões → 07 Retenção.
  - E-commerce: 01 Impressões → 07 Recompra.
  - PDV: 01 Fluxo/Impressões → 07 Recompra (05 N/A).
- Atualizar autoimportação:
  - Impressões/CPM -> **trava01**
  - CTR/Cliques/CPC -> **trava02**
  - Leads/CPL -> **trava03**
- Garantir que a UI do wizard mostre os rótulos corretos e não mantenha textos do mapeamento invertido.

3) Corrigir a análise de IA (backend function)
- Reescrever `travaStructures` no `diagnostic-ai-analysis` para refletir a numeração correta (01 topo, 07 fundo).
- Reforçar no prompt:
  - numeração canônica,
  - variação por modelo,
  - categorias corretas por trava,
  - análise obrigatória em 07→01.
- Adicionar pós-processamento defensivo da resposta da IA:
  - normalizar IDs e nomes de trava para o padrão canônico,
  - deduplicar `stage_scores` por trava,
  - manter apenas um gargalo ativo coerente,
  - ordenar saída em 07→01 (análise) e usar 01→07 quando necessário para exibição.

4) Corrigir Resultados (painel, bowtie, tabela e PDF)
- Trocar mapeamento fixo por mapeamento canônico por modelo.
- Exibir consistentemente: **Trava XX · Estágio · Categoria**.
- Painel de Travas por categorias corretas:
  - Retenção: 07
  - Compromisso: 06,05
  - Interesse: 04,03,02
  - Atenção: 01
  - Cegueira: 00 separado
- Garantir 1 único gargalo visual (badge/pulse) após normalização.
- No fluxo de receita manter apenas percentual (sem “impressions: ...”).
- Atualizar exportação PDF para usar mesma nomenclatura/categoria oficial.

5) Corrigir telas auxiliares para consistência global
- Atualizar `DiagnosticModel` (cards metodológicos) para não exibir mais 07=Exposição.
- Atualizar `diagnosticBenchmarks.ts` (`BENCHMARK_STAGES`) para rótulos coerentes com 01→07.
- Ajustar textos hardcoded em `DiagnosticTOC` que ainda referenciam numeração antiga.

Validação (QA)
- Cenário inside_sales:
  - problema em Reuniões -> Trava 05 / Compromisso.
  - problema em Impressões/CPM -> Trava 01 / Atenção.
  - problema em Churn/Recompra -> Trava 07 / Retenção.
- Cenário PDV:
  - Trava 05 aparece como “não se aplica”.
- Conferir:
  - painel sem dupla trava ativa,
  - tabela com número+estágio+categoria corretos,
  - PDF com mesmos rótulos do layout,
  - modo claro/escuro sem regressão.
- Compatibilidade:
  - aplicar normalização para diagnósticos antigos (evitar obrigar novo diagnóstico só para corrigir label/ID); novo diagnóstico fica recomendado para gerar narrativa IA já no padrão novo.

Detalhes técnicos (arquivos principais)
- `supabase/functions/diagnostic-ai-analysis/index.ts` (prompt + estrutura + normalização da resposta)
- `src/pages/diagnostic/DiagnosticWizard.tsx` (inputs e autoimport na numeração correta)
- `src/pages/diagnostic/DiagnosticResults.tsx` (renderização canônica completa)
- `src/pages/diagnostic/DiagnosticModel.tsx` (documentação visual interna)
- `src/lib/diagnosticBenchmarks.ts` (labels de etapas)
- `src/pages/DiagnosticTOC.tsx` (hardcodes de referência)
