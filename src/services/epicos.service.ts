import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { epicos } from "@/db/schema";
import { registrarEvento } from "./auditoria.service";
import { AUTOR_PADRAO } from "@/lib/constantes";

export function listarEpicos() {
  return db.select().from(epicos).all();
}

export function criarEpico(params: { nome: string; descricao?: string; autor?: string }) {
  const nome = params.nome.trim();
  if (!nome) throw new Error("Informe o nome do épico.");

  const epico = {
    id: randomUUID(),
    projetoId: null,
    nome,
    descricao: params.descricao?.trim() || null,
    camposCustom: null,
    criadoEm: new Date(),
  };

  db.insert(epicos).values(epico).run();
  registrarEvento({
    autor: params.autor ?? AUTOR_PADRAO,
    entidade: "epico",
    entidadeId: epico.id,
    evento: "epico_criado",
    valorNovo: { nome, descricao: epico.descricao },
  });

  return epico;
}
