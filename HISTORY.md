
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.7.0] - Dashboard de Produção Diária (Operador)
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Nova Tela "Produção Diária"**: Acessível pelo operador no início do apontamento.
    - **Metas Dinâmicas**: Cálculo automático de horas disponíveis (9h Seg-Qui, 8h Sex, 4h Sab).
    - **Indicadores de Performance**: Visualização de porcentagem de conclusão do dia e comparativo com o dia anterior.
    - **Gráfico Real vs Meta**: Gráfico de barras simplificado para acompanhamento visual do tempo apontado.
    - **Lista de Hoje**: Listagem rápida dos serviços realizados no turno atual.

## [v1.6.0] - Persistência de Sessão em Nuvem
- **Data**: 29 de Janeiro de 2026
- **Mudanças**:
    - **Sessão Ativa no Firestore**: Agora o cronômetro é salvo no banco de dados em tempo real.
    - **Recuperação Pós-Logout/Fechamento**: Se o usuário fechar o app ou deslogar com um cronômetro rodando, ao voltar ele verá exatamente onde parou.

... (restante do histórico omitido por brevidade)
