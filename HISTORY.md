
# Histórico de Desenvolvimento - IMEK Gestão de Produção

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

## [v1.9.0] - Persistência e Segurança Mobile
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **LocalStorage + Firebase**: Sistema de salvamento híbrido para evitar perda de dados.
    - **Wake Lock API**: Prevenção de suspensão da tela/processo em dispositivos mobile.
    - **Sync Heartbeat**: Sincronização automática a cada 60 segundos.

## [v1.8.0] - Gestão de Pausas com Motivo
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Funcionalidade de Pausa**: Botão adicionado aos cronômetros.
    - **Registro de Motivo**: Obrigatoriedade de informar o motivo da pausa.
    - **Cálculo de Tempo Líquido**: Desconto automático de pausas no tempo de produção.
