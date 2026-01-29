# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.3.2 - Limpeza de Dependências de Runtime
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Removidos pacotes `vite` e `@vitejs/plugin-react` do `importmap` no `index.html`. Isso corrige o erro `SyntaxError: Unexpected token 'export'`.
    - Criado o arquivo `CHECKLIST.md` para diagnóstico de problemas de permissão no Firebase.
    - Otimização do carregamento de módulos ESM via esm.sh.

## Versão 1.3.1 - Correção Técnica de Runtime
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Adicionado log de erro detalhado no `firebaseService.ts`.
    - Melhorado o feedback de erro na interface.

## Versão 1.3.0 - Correção de Build e Remoção de IA
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Inclusão do `@vitejs/plugin-react` para o build do Render.
    - Remoção completa do Google Gemini AI.