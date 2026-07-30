import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { definicoesCampos, TIPOS_CAMPO } from "@/db/schema";
import { registrarEvento } from "./auditoria.service";
import { AUTOR_PADRAO } from "@/lib/constantes";

export function listarCampos(aplicaA?: "tarefa" | "epico" | "projeto") {
  const todos = db.select().from(definicoesCampos).all();
  return aplicaA ? todos.filter((c) => c.aplicaA === aplicaA) : todos;
}

function gerarChave(rotulo: string) {
  return rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function criarCampo(params: {
  rotulo: string;
  tipo: (typeof TIPOS_CAMPO)[number];
  aplicaA: "tarefa" | "epico" | "projeto";
  opcoes?: string[];
  exibirNoCartao?: boolean;
  autor?: string;
}) {
  const rotulo = params.rotulo.trim();
  if (!rotulo) throw new Error("Informe o rótulo do campo.");
  if (!TIPOS_CAMPO.includes(params.tipo)) throw new Error("Tipo de campo inválido.");
  if (params.tipo === "selecao" && (!params.opcoes || params.opcoes.length === 0)) {
    throw new Error("Campos de seleção precisam de ao menos uma opção.");
  }

  const chave = gerarChave(rotulo);
  if (!chave) throw new Error("O rótulo precisa conter letras ou números.");

  const jaExiste = db
    .select()
    .from(definicoesCampos)
    .where(eq(definicoesCampos.chave, chave))
    .all();
  if (jaExiste.length > 0) throw new Error(`Já existe um campo com a chave "${chave}".`);

  const campo = {
    id: randomUUID(),
    chave,
    rotulo,
    tipo: params.tipo,
    opcoes: params.opcoes ?? null,
    aplicaA: params.aplicaA,
    exibirNoCartao: params.exibirNoCartao ?? false,
    ativa: true,
    criadoEm: new Date(),
  };

  db.insert(definicoesCampos).values(campo).run();
  registrarEvento({
    autor: params.autor ?? AUTOR_PADRAO,
    entidade: "definicao_campo",
    entidadeId: campo.id,
    evento: "campo_criado",
    valorNovo: { chave, rotulo, tipo: params.tipo, aplicaA: params.aplicaA, opcoes: params.opcoes },
  });

  return campo;
}

/**
 * Campos não são excluídos, são desativados. Excluir apagaria o significado
 * de valores históricos já gravados em campos_custom, quebrando o lastro.
 */
export function alternarCampo(id: string, ativa: boolean, autor = AUTOR_PADRAO) {
  const [atual] = db.select().from(definicoesCampos).where(eq(definicoesCampos.id, id)).all();
  if (!atual) throw new Error("Campo não encontrado.");
  if (atual.ativa === ativa) return atual;

  db.update(definicoesCampos).set({ ativa }).where(eq(definicoesCampos.id, id)).run();
  registrarEvento({
    autor,
    entidade: "definicao_campo",
    entidadeId: id,
    evento: ativa ? "campo_reativado" : "campo_desativado",
    valorAnterior: { ativa: atual.ativa },
    valorNovo: { ativa },
  });

  return { ...atual, ativa };
}
