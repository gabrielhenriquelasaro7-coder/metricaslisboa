# Plano de Reestruturação Visual e Segurança do Sistema

## Resumo

Transformar o sistema atual (que usa sidebar + seletor de projetos em tela separada) para um layout unificado com **menubar no topo** e **seletor de cliente tipo dropdown** (similar ao Google Ads / Meta Ads), mantendo tudo responsivo para celular. Adicionar criptografia para proteger API keys expostas.

---

## O Que Muda

**Antes:** Login -> Tela de seletor de projetos (cards) -> Sidebar lateral fixa com navegacao -> Tela de cada funcionalidade

**Depois:** Login -> Tela principal unificada com sidebar -> Dropdown de cliente no canto -> Todo conteudo na mesma area

---

## Fase 1: Layout Unificado com sidebar

### 1.1 Novo componente `SideBar`

- Barra fixa no canto com:
  - Logo V4 (esquerda)
  - **Dropdown de seletor de cliente** (similar ao Google Ads) - mostra o cliente ativo e permite trocar sem sair da tela
  - Links de navegacao: Dashboard, Campanhas, Criativos, Financeiro, WhatsApp
  - Mais opcoes via dropdown: Sugestoes, Historico, Administracao, Configuracoes
  - Avatar do usuario + menu de perfil (direita)
  - Toggle de tema (dark/light)

### 1.2 No celular

- O menubar se adapta: logo + dropdown de cliente + botao hamburger
- O hamburger abre um Sheet/drawer com todas as opcoes de navegacao
- Todos os dropdowns funcionam como bottom sheets no mobile

### 1.3 Novo `DashboardLayout` (simplificado)

- Layout: TopSideBar (fixo no topo) + conteudo abaixo
- Sem necessidade de margem lateral para sidebar

### 1.4 Seletor de cliente no menubar

- Dropdown com busca integrada (campo de pesquisa)
- Mostra nome do cliente, indicador de status (safe/care/danger), modelo de negocio
- Ao trocar de cliente, o conteudo da pagina atualiza automaticamente (ja funciona assim hoje via localStorage)

---

## Fase 2: Simplificacao de Telas

### 2.1 Remover tela separada de ProjectSelector

- A funcionalidade de criar/editar/arquivar projetos sera acessivel via:
  - Item "Gerenciar Projetos" dentro do dropdown de cliente no menubar
  - Ou uma secao dentro de Configuracoes/Admin

### 2.2 Manter todas as paginas existentes

- Dashboard, Campaigns, AdSets, AdDetail, Creatives, Financial, WhatsApp, Settings, Admin
- Apenas o **wrapper de layout** muda (de Sidebar para TopMenuBar)
- O conteudo interno das paginas permanece identico

---

## Fase 3: Seguranca - Criptografia de API Keys

### 3.1 Problema atual

- API keys (Meta access token, Evolution API key, etc.) estao visiveis no codigo fonte do navegador ou nas chamadas de rede

### 3.2 Solucao

- **Mover TODAS as chamadas com API keys para Edge Functions** (backend) - as keys ficam em secrets do servidor, nunca chegam ao frontend
- Auditar o codigo para garantir que nenhuma API key sensivel e passada do frontend
- As API keys ja estao configuradas como secrets do backend - precisamos garantir que o frontend NUNCA as receba

### 3.3 Implementacao

- Revisar todas as chamadas que usam tokens no frontend
- Criar/ajustar Edge Functions como proxy para APIs externas
- O frontend chama a Edge Function, que injeta a key no servidor

---

## Detalhes Tecnicos

### Arquivos a criar:

- `src/components/layout/TopSideBar.tsx` - novo menubar principal
- `src/components/layout/ClientSelector.tsx` - dropdown de seletor de cliente com busca

### Arquivos a modificar:

- `src/components/layout/DashboardLayout.tsx` - substituir Sidebar por TopMenuBar
- `src/App.tsx` - ajustar rota de `/projects` (redirecionar para dashboard com dialog de gerenciamento)
- Todas as paginas que usam `DashboardLayout` (nenhuma mudanca interna, apenas o layout externo muda)

### Arquivos a remover/deprecar:

- `src/components/layout/Sidebar.tsx` - substituido pelo TopSideBar
- `src/pages/ProjectSelector.tsx` - funcionalidade movida para dentro do menubar

### Navegacao no MenuBar (desktop):

```text
[Logo] [Cliente: dropdown] | Dashboard | Campanhas | Criativos | Financeiro | WhatsApp | [Mais v] | [Avatar]
```

### Navegacao no MenuBar (mobile):

```text
[Logo] [Cliente: dropdown] [Hamburguer]
```

### Bibliotecas

- Nenhuma nova dependencia necessaria - usaremos os componentes Radix/shadcn ja instalados (DropdownMenu, NavigationMenu, Sheet)

### Sequencia de execucao:

1. Criar TopSideBar + ClientSelector
2. Atualizar DashboardLayout para usar TopSideBar
3. Mover logica de gerenciamento de projetos para dialog acessivel pelo menubar
4. Auditar e corrigir exposicao de API keys
5. Testar responsividade em mobile