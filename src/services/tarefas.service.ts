import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, raw } from "@/db/client";
import { tarefas, STATUS_TAREFA, type Tarefa } from "@/db/schema";
import { registrarEvento } from "./auditoria.service";
import { listarCampos } from "./campos.service";
import { AUTOR_PADRAO } from "@/lib/constantes";
import { publicar } from "@/automacao/barramento";
import { contextoDeTarefa } from "@/automacao/motor";

export function listarTarefas() {
  return db.select().from(tarefas).orderBy(desc(tarefas.criadoEm)).all();
}

function validarCamposCustom(entrada: Record<string, unknown> | undefined) {
  const definicoes = listarCampos("tarefa").filter((c) => c.ativa);
  const chavesValidas = new Set(definicoes.map((c) => c.chave));
  const resultado: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(entrada ?? {})) {
    if (!chavesValidas.has(chave)) {
      throw new Error(`Campo "${chave}" não existe ou está desativado.`);
    }
    if (valor !== "" && valor !== null && valor !== undefined) resultado[chave] = valor;
  }
  return resultado;
}

/**
 * Grava tarefa + log dentro da mesma transação: ou os dois acontecem, ou nenhum.
 */
export function criarTarefa(params: {
  titulo: string;
  responsavel?: string;
  prazoInicial?: string | null;
  epicoId?: string | null;
  camposCustom?: Record<string, unknown>;
  autor?: string;
}) {
  const titulo = params.titulo.trim();
  if (!titulo) throw new Error("Informe o título da tarefa.");

  const camposCustom = validarCamposCustom(params.camposCustom);
  const prazo = params.prazoInicial ? new Date(params.prazoInicial) : null;
  const tarefa = {
    id: randomUUID(),
    epicoId: params.epicoId || null,
    titulo,
    status: "pendente_outras_etapas" as const,
    responsavel: params.responsavel?.trim() || null,
    prazoInicial: prazo,
    prazoAtual: prazo,
    concluidaEm: null,
    linksExternos: null,
    camposCustom,
    ordem: 0,
    criadoEm: new Date(),
  };

  raw.transaction(() => {
    db.insert(tarefas).values(tarefa).run();
    registrarEvento({
      autor: params.autor ?? AUTOR_PADRAO,
      entidade: "tarefa",
      entidadeId: tarefa.id,
      evento: "tarefa_criada",
      valorNovo: {
        titulo,
        status: tarefa.status,
        responsavel: tarefa.responsavel,
        epicoId: tarefa.epicoId,
        prazoInicial: prazo?.toISOString() ?? null,
        camposCustom,
      },
    });
  })();

  publicar("tarefa_criada", { ...contextoDeTarefa(tarefa as never), autor: params.autor ?? AUTOR_PADRAO });
  return tarefa;
}

/**
 * Mudança de status pelo Kanban. Ao concluir depois do prazo atual,
 * o evento "entrega_atrasada" é gravado automaticamente na mesma transação.
 */
export function moverTarefa(tarefaId: string, novoStatus: string, autor = AUTOR_PADRAO) {
  if (!(STATUS_TAREFA as readonly string[]).includes(novoStatus)) {
    throw new Error("Status inválido.");
  }
  const [atual] = db.select().from(tarefas).where(eq(tarefas.id, tarefaId)).all();
  if (!atual) throw new Error("Tarefa não encontrada.");
  if (atual.status === novoStatus) return atual;

  const concluindo = novoStatus === "concluido";
  const reabrindo = atual.status === "concluido" && !concluindo;
  const concluidaEm = concluindo ? new Date() : reabrindo ? null : atual.concluidaEm;

  raw.transaction(() => {
    db.update(tarefas)
      .set({ status: novoStatus as Tarefa["status"], concluidaEm })
      .where(eq(tarefas.id, tarefaId))
      .run();

    registrarEvento({
      autor,
      entidade: "tarefa",
      entidadeId: tarefaId,
      evento: "mudanca_status",
      valorAnterior: { status: atual.status },
      valorNovo: { status: novoStatus },
    });

    if (concluindo && atual.prazoAtual && concluidaEm && concluidaEm > atual.prazoAtual) {
      const diasAtraso = Math.ceil(
        (concluidaEm.getTime() - atual.prazoAtual.getTime()) / 86_400_000
      );
      registrarEvento({
        autor,
        entidade: "tarefa",
        entidadeId: tarefaId,
        evento: "entrega_atrasada",
        valorNovo: {
          diasAtraso,
          prazoInicial: atual.prazoInicial?.toISOString() ?? null,
          prazoAtual: atual.prazoAtual?.toISOString() ?? null,
          concluidaEm: concluidaEm.toISOString(),
        },
      });
    }
  })();

  const depois = { ...atual, status: novoStatus as Tarefa["status"], concluidaEm };
  const contexto = { ...contextoDeTarefa(depois), autor, statusAnterior: atual.status };
  publicar("mudanca_status", contexto);
  if (concluindo && atual.prazoAtual && concluidaEm && concluidaEm > atual.prazoAtual) {
    const diasAtraso = Math.ceil(
      (concluidaEm.getTime() - atual.prazoAtual.getTime()) / 86_400_000
    );
    publicar("entrega_atrasada", { ...contexto, diasAtraso });
  }
  return depois;
}

/**
 * Edição pelo painel do cartão. Cada mudança gera seu próprio evento no log,
 * com antes e depois, tudo dentro de uma única transação.
 */
export function atualizarTarefa(
  tarefaId: string,
  mudancas: {
    titulo?: string;
    responsavel?: string | null;
    prazoAtual?: string | null;
    epicoId?: string | null;
    linksExternos?: { rotulo: string; url: string }[];
    camposCustom?: Record<string, unknown>;
  },
  autor = AUTOR_PADRAO
) {
  const [atual] = db.select().from(tarefas).where(eq(tarefas.id, tarefaId)).all();
  if (!atual) throw new Error("Tarefa não encontrada.");

  const eventos: { evento: string; valorAnterior?: unknown; valorNovo?: unknown }[] = [];
  const set: Partial<Tarefa> = {};

  if (mudancas.titulo !== undefined) {
    const titulo = mudancas.titulo.trim();
    if (!titulo) throw new Error("O título não pode ficar vazio.");
    if (titulo !== atual.titulo) {
      set.titulo = titulo;
      eventos.push({
        evento: "edicao_titulo",
        valorAnterior: { titulo: atual.titulo },
        valorNovo: { titulo },
      });
    }
  }

  if (mudancas.responsavel !== undefined) {
    const responsavel = mudancas.responsavel?.trim() || null;
    if (responsavel !== atual.responsavel) {
      set.responsavel = responsavel;
      eventos.push({
        evento: "troca_responsavel",
        valorAnterior: { responsavel: atual.responsavel },
        valorNovo: { responsavel },
      });
    }
  }

  if (mudancas.epicoId !== undefined) {
    const epicoId = mudancas.epicoId || null;
    if (epicoId !== atual.epicoId) {
      set.epicoId = epicoId;
      eventos.push({
        evento: "vinculo_epico",
        valorAnterior: { epicoId: atual.epicoId },
        valorNovo: { epicoId },
      });
    }
  }

  if (mudancas.prazoAtual !== undefined) {
    const novoPrazo = mudancas.prazoAtual ? new Date(mudancas.prazoAtual) : null;
    const anterior = atual.prazoAtual?.getTime() ?? null;
    if ((novoPrazo?.getTime() ?? null) !== anterior) {
      set.prazoAtual = novoPrazo;
      // Se a tarefa nunca teve prazo, o primeiro prazo definido vira o inicial.
      if (!atual.prazoInicial && novoPrazo) set.prazoInicial = novoPrazo;
      eventos.push({
        evento: atual.prazoInicial ? "repactuacao_prazo" : "definicao_prazo",
        valorAnterior: { prazoAtual: atual.prazoAtual?.toISOString() ?? null },
        valorNovo: {
          prazoAtual: novoPrazo?.toISOString() ?? null,
          prazoInicial: (set.prazoInicial ?? atual.prazoInicial)?.toISOString() ?? null,
        },
      });
    }
  }

  if (mudancas.linksExternos !== undefined) {
    const links = mudancas.linksExternos.filter((l) => l.url.trim());
    if (JSON.stringify(links) !== JSON.stringify(atual.linksExternos ?? [])) {
      set.linksExternos = links;
      eventos.push({
        evento: "links_atualizados",
        valorAnterior: { links: atual.linksExternos ?? [] },
        valorNovo: { links },
      });
    }
  }

  if (mudancas.camposCustom !== undefined) {
    const novos = validarCamposCustom(mudancas.camposCustom);
    const anteriores = atual.camposCustom ?? {};
    const chaves = new Set([...Object.keys(anteriores), ...Object.keys(novos)]);
    let mudou = false;
    for (const chave of Array.from(chaves)) {
      if (JSON.stringify(anteriores[chave]) !== JSON.stringify(novos[chave])) {
        mudou = true;
        eventos.push({
          evento: "campo_alterado",
          valorAnterior: { campo: chave, valor: anteriores[chave] ?? null },
          valorNovo: { campo: chave, valor: novos[chave] ?? null },
        });
      }
    }
    if (mudou) set.camposCustom = novos;
  }

  if (eventos.length === 0) return atual;

  raw.transaction(() => {
    db.update(tarefas).set(set).where(eq(tarefas.id, tarefaId)).run();
    for (const e of eventos) {
      registrarEvento({ autor, entidade: "tarefa", entidadeId: tarefaId, ...e });
    }
  })();

  const depois = { ...atual, ...set };
  const contexto = { ...contextoDeTarefa(depois as never), autor };
  for (const e of eventos) publicar(e.evento, contexto);
  return depois;
}
