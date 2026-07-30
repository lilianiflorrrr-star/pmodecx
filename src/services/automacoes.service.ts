import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  automacoes,
  GATILHOS,
  TIPOS_ACAO,
  type CondicaoAutomacao,
  type AcaoAutomacao,
} from "@/db/schema";
import { registrarEvento } from "./auditoria.service";
import { AUTOR_PADRAO } from "@/lib/constantes";

export function listarAutomacoes() {
  return db.select().from(automacoes).orderBy(desc(automacoes.criadoEm)).all();
}

export function criarAutomacao(params: {
  nome: string;
  gatilho: string;
  condicoes?: CondicaoAutomacao[];
  acoes: AcaoAutomacao[];
  autor?: string;
}) {
  const nome = params.nome.trim();
  if (!nome) throw new Error("Informe o nome da regra.");
  if (!(GATILHOS as readonly string[]).includes(params.gatilho)) {
    throw new Error("Gatilho inválido.");
  }
  if (!params.acoes || params.acoes.length === 0) {
    throw new Error("A regra precisa de ao menos uma ação.");
  }
  for (const acao of params.acoes) {
    if (!(TIPOS_ACAO as readonly string[]).includes(acao.tipo)) {
      throw new Error(`Tipo de ação inválido: ${acao.tipo}.`);
    }
    if (acao.tipo === "webhook" && !acao.params?.url) {
      throw new Error("A ação de webhook precisa de uma URL.");
    }
    if (acao.tipo === "mover_status" && !acao.params?.status) {
      throw new Error("A ação de mover status precisa do status de destino.");
    }
    if (acao.tipo === "atualizar_campo" && (!acao.params?.chave || acao.params?.valor === undefined)) {
      throw new Error("A ação de atualizar campo precisa de chave e valor.");
    }
  }

  const regra = {
    id: randomUUID(),
    nome,
    ativa: true,
    gatilho: params.gatilho,
    condicoes: (params.condicoes ?? []).filter((c) => c.campo && c.operador),
    acoes: params.acoes,
    criadoEm: new Date(),
  };

  db.insert(automacoes).values(regra).run();
  registrarEvento({
    autor: params.autor ?? AUTOR_PADRAO,
    entidade: "automacao",
    entidadeId: regra.id,
    evento: "automacao_criada",
    valorNovo: { nome, gatilho: regra.gatilho, condicoes: regra.condicoes, acoes: regra.acoes },
  });

  return regra;
}

export function alternarAutomacao(id: string, ativa: boolean, autor = AUTOR_PADRAO) {
  const [atual] = db.select().from(automacoes).where(eq(automacoes.id, id)).all();
  if (!atual) throw new Error("Regra não encontrada.");
  if (atual.ativa === ativa) return atual;

  db.update(automacoes).set({ ativa }).where(eq(automacoes.id, id)).run();
  registrarEvento({
    autor,
    entidade: "automacao",
    entidadeId: id,
    evento: ativa ? "automacao_reativada" : "automacao_desativada",
    valorAnterior: { ativa: atual.ativa },
    valorNovo: { ativa },
  });

  return { ...atual, ativa };
}
