
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.6.0] - Persistência de Sessão em Nuvem
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Sessão Ativa no Firestore**: Agora o cronômetro é salvo no banco de dados em tempo real.
    - **Recuperação Pós-Logout/Fechamento**: Se o usuário fechar o app ou deslogar com um cronômetro rodando, ao voltar ele verá exatamente onde parou.
    - **Sincronização entre Dispositivos**: O operador pode iniciar um cronômetro no tablet e finalizar no smartphone.
    - **Indicador de Sincronismo**: Nova UI informando que a sessão está salva na nuvem.

## [v1.5.1] - Remoção da IA Gemini
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: Remoção da integração com Gemini a pedido do usuário, mantendo dashboards manuais.

## [v1.5.0] - Dashboards de Inteligência Industrial e Filtros Avançados
- **Data**: 29 de Janeiro de 2026
- **Mudanças**: Integração com Recharts para visualização de eficiência e filtros de data na listagem.

## [v1.1.0] - Migração para Firebase
- **Data**: 25 de Janeiro de 2026
- **Mudanças**: Transição de Google Sheets para Cloud Firestore.
