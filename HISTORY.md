
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.10.0] - IMEK AI & Dashboard de Performance
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **Dashboard de Performance**: Reintrodução de gráficos comparativos (Peças vs Horas) utilizando Recharts.
    - **IMEK AI (Gemini 3 Pro)**: Integração com IA para análise de gargalos e geração de insights acionáveis baseados nos dados reais de produção.
    - **Módulo de Gestão**: Menu dedicado para separar relatórios tabulares de dashboards analíticos.

## [v1.9.0] - Persistência Híbrida e Segurança Mobile
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **Multi-layer Persistence**: Dados agora são salvos simultaneamente no LocalStorage e Firebase, garantindo recuperação instantânea em quedas de sinal.
    - **Heartbeat Sync**: Sincronização automática em segundo plano a cada 60 segundos durante a produção.
    - **Wake Lock API**: Implementação de trava de tela para impedir que o celular entre em sono profundo e suspenda o processo do cronômetro.
    - **Sync Indicator**: Selo visual no cronômetro indicando o status da sincronização com a nuvem em tempo real.

## [v1.8.1] - Correção de Race Condition
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Bug Fix**: Correção de falha onde sessões de máquinas específicas não eram criadas no banco devido a atualizações assíncronas de estado.
    - **Identificação Garantida**: O início da produção agora aguarda a persistência inicial antes de liberar o cronômetro.

## [v1.8.0] - Gestão de Pausas com Motivo
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Funcionalidade de Pausa**: Botão adicionado aos cronômetros de Setup e Produção.
    - **Registro de Motivo**: Obrigatoriedade de informar o motivo da pausa antes de retomar.
    - **Cálculo de Tempo Líquido**: O cronômetro agora desconta automaticamente o tempo total de pausas do tempo de produção.
    - **Persistência de Pausa**: Se o app for fechado durante uma pausa, ele retornará no estado pausado com o tempo congelado corretamente.

## [v1.7.0] - Dashboard de Produção Diária (Operador)
- **Data**: 28 de Janeiro de 2026
- **Mudanças**:
    - Visualização de progresso diário por metas de horas para o operador.
