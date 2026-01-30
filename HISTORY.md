
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.5.1] - Remoção da IA Gemini
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - Remoção total da integração com Google Gemini API a pedido do usuário.
    - Manutenção de todos os filtros avançados (operador, data, metas).
    - Manutenção dos dashboards gráficos (Produção e Eficiência) via Recharts.

## [v1.5.0] - Dashboards de Inteligência Industrial e Filtros Avançados
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Correção de Build**: Integração definitiva da biblioteca Recharts no ambiente Vite.
    - **Filtros de Data nos Registros**: Adição de campos de data inicial e final na listagem de apontamentos para consultas retroativas.
    - **Módulo de Análise com Dashboard**:
        - Filtro seletivo por Operador e Intervalo de Datas.
        - Configuração dinâmica de "Meta de Horas Disponíveis".
        - Gráfico 1: Produção diária quantitativa (Bar Chart).
        - Gráfico 2: Eficiência temporal (Composed Chart) comparando Horas Reais vs Meta de Disponibilidade.

## [v1.4.6] - Redundância de Marco Temporal (Session Backup)
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: Salvamento paralelo no `sessionStorage` e recuperação automática de timestamps.

## [v1.4.0] - Expansão Gestão
- **Data**: 28 de Janeiro de 2026
- **Mudanças**: Portal do Administrador inicial.

## [v1.1.0] - Migração para Firebase
- **Data**: 25 de Janeiro de 2026
- **Mudanças**: Transição para Cloud Firestore.

## [v1.0.0] - Versão Inicial (Legado)
- **Data**: Janeiro de 2026
- **Descrição**: Aplicação operando via scripts Google Sheets.
