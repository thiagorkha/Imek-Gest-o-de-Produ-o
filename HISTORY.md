
# Histórico de Desenvolvimento - IMEK Gestão de Produção

## [v1.12.0] - Correções de Lógica e Usabilidade
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **Cronômetro**: Corrigido bug onde pausas de setup interferiam no tempo inicial da produção. Agora o tempo de fase é resetado corretamente ao trocar de modo.
    - **Finalização**: Implementado "congelamento" do tempo ao clicar em Finalizar OP, evitando que o cronômetro continue rodando na tela de resumo.
    - **Histórico**: Adicionado filtro por Operador na tela de registros salvos.
    - **Navegação**: Adicionado botão de encerrar sessão nas telas de Identificação (Passo 1) e Contador (Timer).
    - **Lógica de Pausa**: Garante que o tempo total de pausas da sessão seja preservado, enquanto o tempo líquido da fase atual é reiniciado.

## [v1.11.0] - Otimização Responsiva e de Relatórios
- **Data**: 30 de Janeiro de 2026
- **Mudanças**:
    - **UI Responsiva**: Ajuste dinâmico do cronômetro para evitar quebra de layout em telas menores (Mobile).
    - **Exportação Excel**: Padronização completa das colunas solicitadas: "Data", "Hora Início", "Hora Fim", "Operador", "Máquina", "OP", "CP", "Duração Produção (Líquida)", "Duração Setup (Líquida)", "Total Pausas (Sessão)", "Motivos das Pausas", "Quantidade", "Observação".
    - **Formatos de Tempo**: Implementado formato `HH:mm:ss` para todas as colunas de tempo e duração na planilha exportada.
