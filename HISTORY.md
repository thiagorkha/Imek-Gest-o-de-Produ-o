
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.10.2] - Correção de Dados e Dashboards
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **Correção Crítica**: Resolvido problema onde a tela de KPIs ficava em branco por falta de sincronização de dados após o login.
    - **Auto-Sync**: Implementado `useEffect` para carregar registros automaticamente ao acessar módulos de gestão.
    - **UI/UX**: Adicionados estados de "Nenhum dado encontrado" nos gráficos.
    - **Refresh**: Botão de atualização manual adicionado ao BI.

## [v1.10.1] - Correção de Build e Refinamento de IA
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **Build Fix**: Adicionado `@google/genai` ao `package.json` para resolver falha de resolução de módulo no Render.
    - **IA Update**: Padronização da chamada ao modelo `gemini-3-pro-preview` seguindo as diretrizes da API v3.
    - **Estabilidade**: Melhoria na lógica de fallbacks para funções de data.

## [v1.10.0] - Dashboard Analítico e IMEK AI
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **Dashboard de Performance**: Implementação de gráficos avançados (Recharts) com filtros por Operador e Período.
    - **Linha de Disponibilidade**: Adição de meta de horas diárias no gráfico de tempo para análise de ociosidade.
    - **IMEK AI**: Integração com Gemini 3 Pro para análise preditiva e insights de produtividade.
    - **Filtros de Tabela**: Busca por período (Data Início/Fim) na tela de registros salvos.
