import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// CAMADA DE GOVERNANÇA (fixa): sustenta SLA, ICP e auditoria.
// CAMADA DE CONTEÚDO (dinâmica): campos_custom em JSON, descritos em
// definicoes_campos. Criar campo novo não exige migração nem deploy.
// ---------------------------------------------------------------------------

export const projetos = sqliteTable("projetos", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  perfil: text("perfil", { enum: ["implantacao", "acao_cx"] }).notNull(),
  sponsor: text("sponsor"),
  owner: text("owner"),
  // Texto livre, por extenso: contexto, escopo, histórico do projeto.
  descricao: text("descricao"),
  camposCustom: text("campos_custom", { mode: "json" }).$type<Record<string, unknown>>(),
  criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
});

export const epicos = sqliteTable("epicos", {
  id: text("id").primaryKey(),
  projetoId: text("projeto_id").references(() => projetos.id),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  camposCustom: text("campos_custom", { mode: "json" }).$type<Record<string, unknown>>(),
  criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
});

export const STATUS_TAREFA = [
  "pendente_outras_etapas",
  "aguardando_time_externo",
  "acompanhando",
  "em_analise_cx",
  "sob_responsabilidade_pmo",
  "concluido",
] as const;

export const tarefas = sqliteTable(
  "tarefas",
  {
    id: text("id").primaryKey(),
    epicoId: text("epico_id").references(() => epicos.id),
    titulo: text("titulo").notNull(),
    status: text("status", { enum: STATUS_TAREFA })
      .notNull()
      .default("pendente_outras_etapas"),
    responsavel: text("responsavel"),
    prazoInicial: integer("prazo_inicial", { mode: "timestamp" }),
    prazoAtual: integer("prazo_atual", { mode: "timestamp" }),
    concluidaEm: integer("concluida_em", { mode: "timestamp" }),
    linksExternos: text("links_externos", { mode: "json" }).$type<
      { rotulo: string; url: string }[]
    >(),
    camposCustom: text("campos_custom", { mode: "json" }).$type<Record<string, unknown>>(),
    ordem: integer("ordem").notNull().default(0),
    criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    idxStatus: index("idx_tarefas_status").on(t.status),
    idxEpico: index("idx_tarefas_epico").on(t.epicoId),
  })
);

export const documentos = sqliteTable("documentos", {
  id: text("id").primaryKey(),
  projetoId: text("projeto_id").references(() => projetos.id),
  epicoId: text("epico_id").references(() => epicos.id),
  titulo: text("titulo").notNull(),
  conteudo: text("conteudo", { mode: "json" }),
  atualizadoEm: integer("atualizado_em", { mode: "timestamp" }),
});

export const TIPOS_CAMPO = [
  "texto",
  "numero",
  "data",
  "selecao",
  "url",
  "checkbox",
] as const;

export const definicoesCampos = sqliteTable("definicoes_campos", {
  id: text("id").primaryKey(),
  chave: text("chave").notNull().unique(),
  rotulo: text("rotulo").notNull(),
  tipo: text("tipo", { enum: TIPOS_CAMPO }).notNull(),
  opcoes: text("opcoes", { mode: "json" }).$type<string[]>(),
  aplicaA: text("aplica_a", { enum: ["tarefa", "epico", "projeto"] }).notNull(),
  exibirNoCartao: integer("exibir_no_cartao", { mode: "boolean" }).default(false),
  ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),
  criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
});

// Registro imutável: a aplicação só executa INSERT.
// Gatilhos no banco (src/db/client.ts) abortam UPDATE e DELETE.
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Milissegundos: a corrente de hash usa getTime() e precisa de precisão total.
    ocorridoEm: integer("ocorrido_em", { mode: "timestamp_ms" }).notNull(),
    autor: text("autor").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id").notNull(),
    evento: text("evento").notNull(),
    valorAnterior: text("valor_anterior", { mode: "json" }),
    valorNovo: text("valor_novo", { mode: "json" }),
    hashCorrente: text("hash_corrente").notNull(),
  },
  (t) => ({
    idxEntidade: index("idx_log_entidade").on(t.entidade, t.entidadeId),
    idxData: index("idx_log_data").on(t.ocorridoEm),
    idxEvento: index("idx_log_evento").on(t.evento),
  })
);

export const GATILHOS = [
  "evento:tarefa_criada",
  "evento:mudanca_status",
  "evento:troca_responsavel",
  "evento:repactuacao_prazo",
  "evento:entrega_atrasada",
  "evento:campo_alterado",
  "tempo:tarefa_atrasada",
  "tempo:sla_d3",
] as const;

export const TIPOS_ACAO = ["slack", "webhook", "mover_status", "atualizar_campo"] as const;

export type CondicaoAutomacao = {
  campo: string;
  operador: "igual" | "diferente" | "contem" | "maior" | "menor";
  valor: string;
};

export type AcaoAutomacao = {
  tipo: (typeof TIPOS_ACAO)[number];
  params: Record<string, string>;
};

export const automacoes = sqliteTable("automacoes", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  ativa: integer("ativa", { mode: "boolean" }).notNull().default(true),
  gatilho: text("gatilho").notNull(),
  condicoes: text("condicoes", { mode: "json" }).$type<CondicaoAutomacao[]>(),
  acoes: text("acoes", { mode: "json" }).$type<AcaoAutomacao[]>(),
  criadoEm: integer("criado_em", { mode: "timestamp" }).notNull(),
});

// Deduplicação dos gatilhos temporais: uma execução por regra,
// por tarefa, por dia (a chave carrega tarefa + data).
export const execucoesAutomacao = sqliteTable("execucoes_automacao", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  automacaoId: text("automacao_id").notNull(),
  chaveDedup: text("chave_dedup").notNull(),
  executadoEm: integer("executado_em", { mode: "timestamp" }).notNull(),
});

export type Automacao = typeof automacoes.$inferSelect;
export type Projeto = typeof projetos.$inferSelect;
export type Tarefa = typeof tarefas.$inferSelect;
export type DefinicaoCampo = typeof definicoesCampos.$inferSelect;
export type EventoLog = typeof auditLog.$inferSelect;
