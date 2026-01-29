# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.4.5 - Blindagem do Marco Temporal (StartTime)
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - **Refatoração de Estado**: O `startTime` foi removido do objeto parcial `prodData` e movido para um estado independente (`productionStartTime`). Isso impede que atualizações em outros campos do formulário (como OP, CP ou Quantidade) resetem acidentalmente o horário de início por falhas de referência de estado.
    - **Integridade de Dados**: Agora o sistema utiliza estados blindados para os marcos temporais (`productionStartTime` e `productionEndTime`), garantindo que o valor capturado no clique inicial chegue intacto ao Firebase.
    - **Display de Relatórios**: Ajustada a tabela de registros salvos para exibir o horário baseado no `startTime` real do banco de dados, não no timestamp de gravação.

## Versão 1.4.4 - Solução Definitiva para Integridade de Dados
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Substituição de atualizações de estado diretas por atualizações funcionais.
    - Adição de travas de segurança no `saveRecord`.

## Versão 1.4.0 - Expansão do Módulo de Gestão
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Reestruturação do fluxo do Administrador: Apontamento vs Gestão.
    - Integração Gemini 3 Pro para análise de performance.