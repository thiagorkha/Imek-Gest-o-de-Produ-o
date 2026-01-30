# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.4.6] - Redundância de Marco Temporal (Session Backup)
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: 
    - Implementação de salvamento paralelo do `startTime` no `sessionStorage` para evitar perda de dados em remontagens de componentes React.
    - Adição de lógica de recuperação automática no momento do salvamento final.
    - Bloqueio de segurança que impede gravações no Firebase caso o timestamp seja inválido (menor que Jan/2024).

## [v1.4.5] - Blindagem do Estado
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: Separação do `startTime` do objeto principal de dados para isolar o valor contra atualizações de campos de texto.

## [v1.4.0] - Expansão Gestão & Inteligência Artificial
- **Data**: 28 de Janeiro de 2026
- **Mudanças**:
    - Criação do Portal do Administrador com divisão entre Apontamento e Gestão.
    - Integração com Gemini 3 Pro para análise automatizada de performance industrial.
    - Adição de relatórios executivos gerados por IA.

## [v1.3.0] - Módulo de Relatórios e Exportação
- **Data**: 27 de Janeiro de 2026
- **Mudanças**:
    - Implementação de visualização de tabela para administradores.
    - Adição de filtros por OP, Máquina e Operador.
    - Funcionalidade de exportação para formato Excel (.xlsx) utilizando a biblioteca XLSX.

## [v1.2.0] - Sistema de Autenticação e Funções
- **Data**: 26 de Janeiro de 2026
- **Mudanças**: 
    - Criação de sistema de Login e Cadastro (Nome/Senha).
    - Implementação de lógica de controle de acesso (UserRoles: Admin vs Operador).
    - Atribuição automática do nome do operador logado ao campo de apontamento.

## [v1.1.0] - Migração para Firebase
- **Data**: 25 de Janeiro de 2026
- **Mudanças**: Transição do armazenamento de dados de Google Sheets para Firebase Cloud Firestore, permitindo maior escalabilidade e performance.

## [v1.0.0] - Versão Inicial (Legado)
- **Data**: Janeiro de 2026
- **Descrição**: Aplicação base operando via scripts de integração com planilhas Google Sheets.