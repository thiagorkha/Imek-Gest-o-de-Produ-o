# Histórico de Desenvolvimento - IMEK Gestão de Produção

## Versão 1.3.3 - Correção de Build (Render) e Dependências
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Adicionado `@google/genai` ao `package.json` para corrigir erro de resolução no Rollup durante o deploy no Render.
    - Removidas chaves de build (`vite`) do `importmap` no `index.html` para evitar conflitos de sintaxe ESM no navegador.
    - Sincronização de dependências entre o ambiente de build e runtime.

## Versão 1.3.2 - Limpeza de Dependências de Runtime
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Removidos pacotes `vite` e `@vitejs/plugin-react` do `importmap`.
    - Criado o arquivo `CHECKLIST.md` para diagnóstico de problemas.

## Versão 1.3.1 - Correção Técnica de Runtime
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Adicionado log de erro detalhado no `firebaseService.ts`.
    - Melhorado o feedback de erro na interface.

## Versão 1.3.0 - Correção de Build e Remoção de IA
- **Data**: 29 de Janeiro de 2026
- **Mudanças principais**:
    - Inclusão do `@vitejs/plugin-react` para o build do Render.
    - Remoção completa do Google Gemini AI (reintroduzido posteriormente via SDK oficial).