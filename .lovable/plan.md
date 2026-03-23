

## Diagnóstico — Correções de Layout, Dados e Prompt da IA

### Problemas Identificados

1. **Bowtie mostra "null"**: Os valores exibidos no Fluxo de Receita e nas barras de progresso mostram "null" quando não há dados, em vez de mostrar "Sem dados" ou ocultar.
2. **Layout de resultados degradado**: O layout antigo (screenshots 3-5) tinha o "Relatório de Restrição" com Eficiência Real e Gap vs Benchmark, o "Painel de Travas" com sliders interativos divididos em Vendas/CS e Marketing, e o Bowtie com visual de funil perspectiva com barras laterais amarelas. Tudo isso se perdeu.
3. **EC e LTP simplistas**: A Evaporating Cloud está em grid genérico sem representação visual do conflito. O LTP não tem profundidade visual.
4. **Prompt da IA**: O prompt atual é adequado na estrutura, mas precisa de melhorias para gerar respostas mais ricas e contextualizadas (usar valor_informado formatado em vez de null, forçar observações descritivas).

### Plano de Implementação

#### 1. Corrigir exibição de "null" no Results
- Substituir todas as ocorrências de `score.valor_informado || '0.00'` e `value` no Bowtie por lógica que exibe "Sem dados" para `null`/`undefined`
- Na Bowtie e nas barras de progresso, quando `status === 'sem_dados'`, mostrar "Sem dados para análise" em vez de "null"

#### 2. Restaurar layout do "Relatório de Restrição" (screenshot 3)
- Adicionar cards laterais de "Eficiência Atual Real" e "Gap vs Benchmark" ao card de Restrição Ativa
- Usar os dados de `stage_scores` para calcular eficiência e gap

#### 3. Restaurar "Painel de Travas" com sliders interativos (screenshot 4)
- Dividir travas em duas colunas: Vendas/CS (07, 06, 05) e Marketing (04, 03, 02)
- Usar `Slider` com gradiente red→green
- Mostrar valor Real vs Benchmark lado a lado
- Botão "Ajustar Benchmarks" (visual only)

#### 4. Restaurar Bowtie visual com perspectiva (screenshot 5)
- Funil com 7 estágios em formato de trapézio/perspectiva
- Barras laterais amarelas, valores grandes no centro
- Setas conectoras entre estágios
- Badge "GARGALO" vermelho no estágio bottleneck
- Remover "null" — mostrar "Sem dados" quando não há valor

#### 5. Melhorar LTP visualmente
- Evaporating Cloud: representar como diagrama de conflito visual (objetivo no topo, duas necessidades, duas ações em conflito, seta da injeção quebrando o conflito)
- CRT: representar como árvore vertical com nós conectados
- FRT, NBR, PRT: manter cards mas com design mais elaborado

#### 6. Melhorar prompt da IA
- Adicionar instrução para que `valor_informado` seja sempre uma string formatada legível (ex: "impressions: 210000, cpm: 14") em vez de null
- Quando não há dados, `valor_informado` deve ser `null` mas `observacao` deve explicar que não há dados
- Adicionar instrução para EC mais detalhada com pressuposto claramente articulado
- Adicionar instrução para sintese com 5+ parágrafos com profundidade analítica
- Instruir a IA a incluir números específicos e benchmarks de referência nas observações

### Arquivos Alterados
- `src/pages/diagnostic/DiagnosticResults.tsx` — Layout completo restaurado
- `supabase/functions/diagnostic-ai-analysis/index.ts` — Prompt melhorado

