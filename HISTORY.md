
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.5.0] - Dashboards de Inteligência e Filtros Dinâmicos
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Filtros de Data nos Registros**: Implementação de seleção de intervalo (De/Até) na listagem de apontamentos salvos.
    - **Gráficos Industriais**: Integração da biblioteca Recharts para visualização de performance.
    - **Novo Módulo de Análise**:
        - Filtro por Operador específico para análise de produtividade individual.
        - Definição de meta de Horas Disponíveis por Dia.
        - Gráfico de barras para volume de peças produzidas.
        - Gráfico composto para Eficiência de Horas (Real vs Meta).
    - **Sincronização com IA**: O Gemini 3 Pro agora analisa contextualmente os filtros aplicados e as metas definidas pelo usuário.

## [v1.4.6] - Redundância de Marco Temporal (Session Backup)
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: 
    - Implementação de salvamento paralelo do `startTime` no `sessionStorage`.
    - Lógica de recuperação automática e bloqueio de timestamps inválidos (pré-2024).

## [v1.4.5] - Blindagem do Estado
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: Isolamento do `startTime` em estado dedicado para evitar reset por inputs do formulário.

## [v1.4.0] - Expansão Gestão & Inteligência Artificial
- **Data**: 28 de Janeiro de 2026
- **Mudanças**: Portal do Administrador e Integração Gemini.

## [v1.3.0] - Módulo de Relatórios e Exportação
- **Data**: 27 de Janeiro de 2026
- **Mudanças**: Tabela de registros e exportação Excel.

## [v1.2.0] - Sistema de Autenticação
- **Data**: 26 de Janeiro de 2026
- **Mudanças**: Login, Cadastro e Controle de Acesso (Roles).

## [v1.1.0] - Migração para Firebase
- **Data**: 25 de Janeiro de 2026
- **Mudanças**: Firestore como banco de dados principal.

## [v1.0.0] - Versão Inicial (Legado)
- **Data**: Janeiro de 2026
- **Descrição**: Aplicação base operando via scripts Google Sheets.
