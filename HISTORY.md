# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.4.3 - Refinamento Crítico de Integridade Temporal
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Reescrita da lógica de captura do `startTime`: agora o marco inicial é capturado no milissegundo exato do clique em "Iniciar Setup" ou "Iniciar Produção" e bloqueado contra sobrescritas acidentais.
    - O fluxo de transição Setup -> Produção agora preserva o marco inicial da atividade inteira, garantindo relatórios de eficiência 100% fiéis ao evento real.
    - Removido qualquer cálculo de fallback baseado em tempo atual no momento do salvamento.

## Versão 1.4.2 - Ajuste de Precisão no Horário de Início
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Garantido que o `startTime` salvo no banco de dados reflita o momento exato em que o operador clicou no primeiro botão de ação ("Iniciar Setup" ou "Iniciar Produção").
    - Melhorada a clareza na exportação Excel, agora com colunas "Hora Início" e "Hora Fim" formatadas.

## Versão 1.4.0 - Expansão do Módulo de Gestão
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Reestruturação do fluxo do Administrador: Agora permite escolher entre "Apontamento" e "Gestão".
    - Implementação da tela de Gestão com integração Gemini 3 Pro.
