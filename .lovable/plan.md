

# Plano: Clarity Completo — Todas as Métricas + Tradução PT-BR

## Objetivo
Extrair o maximo de dados que a API do Clarity fornece e apresentar tudo em portugues, com visual profissional para analise completa de Landing Pages.

## O que a API do Clarity fornece

**Metricas disponiveis:**
- Traffic (Sessoes, Usuarios, Paginas por sessao)
- Engagement Time (Tempo de engajamento)
- Dead Click Count (Cliques mortos - sim, rastreia botoes!)
- Rage Click Count (Cliques de raiva)
- Error Click Count (Cliques com erro)
- Script Error Count (Erros de script na LP)
- Quickback Click (Cliques de retorno rapido)
- Excessive Scroll (Rolagem excessiva)
- Scroll Depth (Profundidade de rolagem)
- Popular Pages (Paginas mais visitadas)
- Referrer URL (De onde vieram os usuarios)

**Dimensoes para cruzamento:**
- Device (Desktop/Mobile/Tablet)
- Browser (Chrome/Safari/Edge...)
- OS (Windows/iOS/Android...)
- Country/Region (Pais)
- URL (Pagina especifica)
- Source (Fonte de trafego)
- Channel (Canal)
- Campaign (Campanha)
- Medium (Meio)

**Limitacao:** Maximo 3 dimensoes por chamada, 10 chamadas/dia por projeto, dados dos ultimos 1-3 dias.

---

## Mudancas Planejadas

### 1. Edge Function — Chamadas Multiplas
Atualizar o `clarity-proxy` para fazer 3 chamadas paralelas a API do Clarity em uma unica invocacao:
- Chamada 1: `dimension1=Device, dimension2=Browser, dimension3=OS`
- Chamada 2: `dimension1=URL, dimension2=Source, dimension3=Country`
- Chamada 3: `dimension1=Channel, dimension2=Medium, dimension3=Campaign`

Isso usa apenas 3 das 10 chamadas diarias e traz TODOS os dados possiveis.

### 2. Modal de Dados — Layout Completo em PT-BR
Reorganizar o modal com secoes claras, tudo traduzido:

**Resumo Geral (cards no topo):**
- Sessoes | Usuarios | Paginas/Sessao | Tempo de Engajamento

**Saude da LP (indicadores de problema):**
- Cliques Mortos | Cliques de Raiva | Cliques com Erro | Erros de Script | Retorno Rapido | Rolagem Excessiva

**Analise por Dispositivo** — barras horizontais (Desktop vs Mobile vs Tablet)

**Profundidade de Rolagem** — indicador visual de ate onde os usuarios scrollam

**Navegadores** — distribuicao Chrome/Safari/Edge/Firefox

**Sistemas Operacionais** — Windows/iOS/Android/macOS

**Paginas Populares** — ranking das URLs mais acessadas

**Origens de Trafego** — Source/Channel/Medium/Campaign

**Paises** — distribuicao geografica dos visitantes

### 3. Seletor de Periodo
Adicionar toggle para escolher entre 1, 2 ou 3 dias de dados (unica opcao que a API permite).

### 4. Traducao completa
Mapa de traducao de todos os nomes de metricas:

```text
Traffic           -> Trafego
Engagement Time   -> Tempo de Engajamento
Dead Click Count  -> Cliques Mortos
Rage Click Count  -> Cliques de Raiva
Error Click Count -> Cliques com Erro
Script Error Count-> Erros de Script
Quickback Click   -> Retorno Rapido
Excessive Scroll  -> Rolagem Excessiva
Scroll Depth      -> Profundidade de Rolagem
Popular Pages     -> Paginas Populares
Referrer URL      -> URL de Referencia
```

---

## Detalhes Tecnicos

### Edge Function (`clarity-proxy/index.ts`)
- Recebe `numOfDays` (1, 2 ou 3) do frontend
- Executa 3 fetches paralelos com `Promise.all` para diferentes combinacoes de dimensoes
- Retorna objeto agrupado: `{ byDevice: [...], bySource: [...], byChannel: [...] }`

### Frontend (`Clarity.tsx`)
- Novo state para `numOfDays` com toggle de 1/2/3 dias
- Modal expandido (`max-w-4xl`) com scroll e secoes organizadas
- Componentes visuais: barras horizontais para distribuicao, cards coloridos para alertas (vermelho para rage clicks, amarelo para dead clicks, laranja para erros)
- Secao "Saude da LP" com semaforo visual (verde/amarelo/vermelho) baseado em thresholds dos indicadores

### Arquivos Afetados
1. `supabase/functions/clarity-proxy/index.ts` — chamadas paralelas + resposta estruturada
2. `src/pages/Clarity.tsx` — modal completo com todas as metricas, seletor de periodo, traducoes PT-BR

