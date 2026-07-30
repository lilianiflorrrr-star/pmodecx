export const AUTOR_PADRAO = "pmo_cx";

export const COLUNAS_KANBAN = [
  { id: "pendente_outras_etapas", rotulo: "Pendente de outras etapas" },
  { id: "aguardando_time_externo", rotulo: "Aguardando time externo" },
  { id: "acompanhando", rotulo: "Acompanhando" },
  { id: "em_analise_cx", rotulo: "Em análise de CX" },
  { id: "sob_responsabilidade_pmo", rotulo: "Sob responsabilidade do PMO" },
  { id: "concluido", rotulo: "Concluído" },
] as const;

export const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  COLUNAS_KANBAN.map((c) => [c.id, c.rotulo])
);

export const ROTULO_PERFIL_PROJETO: Record<string, string> = {
  implantacao: "Implantação",
  acao_cx: "Ação CX",
};

export const ROTULO_TIPO_CAMPO: Record<string, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  selecao: "Seleção",
  url: "Link (URL)",
  checkbox: "Sim / Não",
};

export const ROTULO_EVENTO: Record<string, string> = {
  campo_criado: "Campo criado",
  campo_desativado: "Campo desativado",
  campo_reativado: "Campo reativado",
  tarefa_criada: "Tarefa criada",
  mudanca_status: "Mudança de status",
  troca_responsavel: "Troca de responsável",
  repactuacao_prazo: "Repactuação de prazo",
  entrega_atrasada: "Entrega fora do prazo",
  definicao_prazo: "Definição de prazo",
  edicao_titulo: "Edição de título",
  vinculo_epico: "Vínculo de épico",
  links_atualizados: "Links atualizados",
  campo_alterado: "Campo alterado",
  epico_criado: "Épico criado",
  projeto_criado: "Projeto criado",
  edicao_nome: "Edição de nome",
  edicao_perfil: "Edição de perfil",
  edicao_sponsor: "Edição de sponsor",
  edicao_owner: "Edição de owner",
  edicao_descricao: "Edição de descrição",
  automacao_criada: "Automação criada",
  automacao_desativada: "Automação desativada",
  automacao_reativada: "Automação reativada",
  acao_executada: "Ação de automação executada",
  falha_automacao: "Falha de automação",
  sincronizacao_sheets: "Espelho no Google Sheets atualizado",
};
