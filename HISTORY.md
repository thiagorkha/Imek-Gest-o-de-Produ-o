
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.4.0 - Expansão do Módulo de Gestão
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Reestruturação do fluxo do Administrador: Agora permite escolher entre "Apontamento" e "Gestão".
    - Implementação da tela de Gestão com sub-opções: "Apontamentos Salvos" e "Análise".
    - Tabela de registros aprimorada com filtros de busca em tempo real (OP, Máquina, Operador) e ordenação por data.
    - Botão de exportação para Excel integrado diretamente na visualização de dados filtrados.
    - Inclusão da tela "Análise" com estado visual de "Em Construção" conforme requisitos.
    - Melhorias de acessibilidade e design responsivo (vidro/blur).

## Versão 1.3.4 - Implementação do Usuário Master
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Atualizada a lógica de registro no `firebaseService.ts` para reconhecer automaticamente o nome de usuário "master" como administrador.

## Versão 1.3.3 - Correção de Build (Render) e Dependências
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Adicionado `@google/genai` ao `package.json` para corrigir erro de resolução no Rollup.
    - Limpeza de dependências de runtime no `importmap`.

## Versão 1.3.0 - Integração Firebase e Sistema de Login
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Substituição do Google Sheets pelo Firebase Firestore.
    - Criação de sistema de autenticação (Nome/Senha).
    - Diferenciação de papéis (Operador vs Admin).
