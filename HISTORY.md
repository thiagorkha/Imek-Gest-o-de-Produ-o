# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.4.4 - Solução Definitiva para Integridade de Dados
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Substituição de atualizações de estado diretas por atualizações funcionais (`setProdData(prev => ...)`). Esta mudança é crítica para evitar que o `startTime` seja sobrescrito por valores padrão (0) quando o usuário preenche campos como OP ou CP.
    - Alteração da inicialização do `startTime` para `undefined`, permitindo uma validação mais robusta antes do salvamento.
    - Adição de trava de segurança no `saveRecord` que bloqueia gravações com horário de início inválido.
    - Refatoração dos handlers `onChange` para garantir imutabilidade total do objeto de registro de produção.

## Versão 1.4.3 - Refinamento Crítico de Integridade Temporal
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Reescrita da lógica de captura do `startTime`: agora o marco inicial é capturado no milissegundo exato do clique em "Iniciar Setup" ou "Iniciar Produção".
    - O fluxo de transição Setup -> Produção agora preserva o marco inicial da atividade inteira.

## Versão 1.4.0 - Expansão do Módulo de Gestão
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Reestruturação do fluxo do Administrador: Agora permite escolher entre "Apontamento" e "Gestão".
    - Implementação da tela de Gestão com integração Gemini 3 Pro.