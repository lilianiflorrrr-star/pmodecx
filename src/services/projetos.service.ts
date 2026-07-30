import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projetos, type Projeto } from "@/db/schema";
import { registrarEvento } from "./auditoria.service";
import { AUTOR_PADRAO } from "@/lib/constantes";

export function listarProjetos() {
  return db.select().from(projetos).orderBy(desc(projetos.criadoEm)).all();
}

export function criarProjeto(params: {
  nome: string;
  perfil: "implantacao" | "acao_cx";
  sponsor?: string;
  owner?: string;
  descricao?: string;
  autor?: string;
}) {
  const nome = params.nome.trim();
  if (!nome) throw new Error("Informe o nome do projeto.");
  if (params.perfil !== "implantacao" && params.perfil !== "acao_cx") {
    throw new Error("Perfil inválido.");
  }

  const projeto = {
    id: randomUUID(),
    nome,
    perfil: params.perfil,
    sponsor: params.sponsor?.trim() || null,
    owner: params.owner?.trim() || null,
    descricao: params.descricao?.trim() || null,
    camposCustom: null,
    criadoEm: new Date(),
  };

  db.insert(projetos).values(projeto).run();
  registrarEvento({
    autor: params.autor ?? AUTOR_PADRAO,
    entidade: "projeto",
    entidadeId: projeto.id,
    evento: "projeto_criado",
    valorNovo: {
      nome,
      perfil: projeto.perfil,
      sponsor: projeto.sponsor,
      owner: projeto.owner,
      descricao: projeto.descricao,
    },
  });

  return projeto;
}

/**
 * Edição do projeto pela tela de Projetos. Cada campo alterado gera seu
 * próprio evento no inventário, com antes e depois.
 */
export function atualizarProjeto(
  projetoId: string,
  mudancas: {
    nome?: string;
    perfil?: "implantacao" | "acao_cx";
    sponsor?: string | null;
    owner?: string | null;
    descricao?: string | null;
  },
  autor = AUTOR_PADRAO
) {
  const [atual] = db.select().from(projetos).where(eq(projetos.id, projetoId)).all();
  if (!atual) throw new Error("Projeto não encontrado.");

  const eventos: { evento: string; valorAnterior?: unknown; valorNovo?: unknown }[] = [];
  const set: Partial<Projeto> = {};

  if (mudancas.nome !== undefined) {
    const nome = mudancas.nome.trim();
    if (!nome) throw new Error("O nome não pode ficar vazio.");
    if (nome !== atual.nome) {
      set.nome = nome;
      eventos.push({
        evento: "edicao_nome",
        valorAnterior: { nome: atual.nome },
        valorNovo: { nome },
      });
    }
  }

  if (mudancas.perfil !== undefined && mudancas.perfil !== atual.perfil) {
    set.perfil = mudancas.perfil;
    eventos.push({
      evento: "edicao_perfil",
      valorAnterior: { perfil: atual.perfil },
      valorNovo: { perfil: mudancas.perfil },
    });
  }

  if (mudancas.sponsor !== undefined) {
    const sponsor = mudancas.sponsor?.trim() || null;
    if (sponsor !== atual.sponsor) {
      set.sponsor = sponsor;
      eventos.push({
        evento: "edicao_sponsor",
        valorAnterior: { sponsor: atual.sponsor },
        valorNovo: { sponsor },
      });
    }
  }

  if (mudancas.owner !== undefined) {
    const owner = mudancas.owner?.trim() || null;
    if (owner !== atual.owner) {
      set.owner = owner;
      eventos.push({
        evento: "edicao_owner",
        valorAnterior: { owner: atual.owner },
        valorNovo: { owner },
      });
    }
  }

  if (mudancas.descricao !== undefined) {
    const descricao = mudancas.descricao?.trim() || null;
    if (descricao !== atual.descricao) {
      set.descricao = descricao;
      eventos.push({
        evento: "edicao_descricao",
        valorAnterior: { descricao: atual.descricao },
        valorNovo: { descricao },
      });
    }
  }

  if (eventos.length === 0) return atual;

  db.update(projetos).set(set).where(eq(projetos.id, projetoId)).run();
  for (const e of eventos) {
    registrarEvento({ autor, entidade: "projeto", entidadeId: projetoId, ...e });
  }

  return { ...atual, ...set };
}
