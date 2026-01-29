# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.3.1 - Correção Técnica de Runtime
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Removidas chaves de build do `importmap` no `index.html` para corrigir erro `SyntaxError: Unexpected token 'export'`.
    - Adicionado log de erro detalhado no `firebaseService.ts` para auxiliar na depuração de falhas de registro/login.
    - Melhorado o feedback de erro na interface do usuário durante o cadastro.

## Versão 1.3.0 - Correção de Build e Remoção de IA
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Inclusão do `@vitejs/plugin-react` para resolver erro de build no Render.
    - Remoção completa do Google Gemini AI.
    - Substituição da tela de análise pela mensagem "Em construção".

## Versão 1.2.1 - Correção de Conflitos de Dependências (Render)
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Padronização do projeto para **React 18.3.1**.