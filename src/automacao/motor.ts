import { db, raw } from "@/db/client";
import {
  automacoes,
  execucoesAutomacao,
  tarefas,
  type Automacao,
  type CondicaoAutomacao,
  type AcaoAutomacao,
  type Tarefa,
} from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { registrarEvento } from "@/services/auditoria.service";
import { avaliarSla } from "@/lib/sla";
import { ROTULO_STATUS } from "@/lib/constantes";

// ---------------------------------------------------------------------------
// Avaliação de condições
// ---------------------------------------------------------------------------

export function condicoesAtendidas(
  condicoes: CondicaoAutomacao[] | null | undefined,
  contexto: Record<string, unknown>
): boolean {
  return (condicoes ?? []).every((c) => {
    const valor = contexto[c.campo];
    switch (c.operador) {
      case "igual":
        return String(valor ?? "") === String(c.valor);
      case "diferente":
        return String(valor ?? "") !== String(c.valor);
      case "contem":
        return String(valor ?? "").toLowerCase().includes(String(c.valor).toLowerCase());
      case "maior":
        return Number(valor) > Number(c.valor);
      case "menor":
        return Number(valor) < Number(c.valor);
      default:
        return false;
    }
  });
}

/** Substitui {{chave}} pelos valores do contexto. */
export function renderizarTemplate(template: string, contexto: Record<string, unknown>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, chave) => {
    const v = contexto[chave];
    return v === undefined || v === null ? "" : String(v);
  });
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

async function executarAcao(
  regra: Automacao,
  acao: AcaoAutomacao,
  contexto: Record<string, unknown>
) {
  const autor = `automacao:${regra.nome}`;

  switch (acao.tipo) {
    case "slack": {
      const url = acao.params.webhookUrl || process.env.SLACK_WEBHOOK;
      if (!url) throw new Error("Webhook do Slack não configurado (SLACK_WEBHOOK ou URL na regra).");
      const mensagem = renderizarTemplate(
        acao.params.mensagem ||
          "Automação {{regra}}: tarefa {{titulo}} (status: {{statusRotulo}}).",
        { ...contexto, regra: regra.nome }
      );
      const resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: mensagem }),
      });
      if (!resposta.ok) throw new Error(`Slack respondeu ${resposta.status}.`);
      return { mensagem };
    }

    case "webhook": {
      if (!acao.params.url) throw new Error("URL do webhook não informada na regra.");
      const resposta = await fetch(acao.params.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regra: regra.nome, contexto }),
      });
      if (!resposta.ok) throw new Error(`Webhook respondeu ${resposta.status}.`);
      return { url: acao.params.url };
    }

    case "mover_status": {
      const tarefaId = String(contexto.tarefaId ?? "");
      if (!tarefaId) throw new Error("Ação mover_status exige uma tarefa no contexto.");
      const { moverTarefa } = await import("@/services/tarefas.service");
      moverTarefa(tarefaId, acao.params.status, autor);
      return { status: acao.params.status };
    }

    case "atualizar_campo": {
      const tarefaId = String(contexto.tarefaId ?? "");
      if (!tarefaId) throw new Error("Ação atualizar_campo exige uma tarefa no contexto.");
      const [atual] = db.select().from(tarefas).where(eq(tarefas.id, tarefaId)).all();
      if (!atual) throw new Error("Tarefa do contexto não encontrada.");
      const { atualizarTarefa } = await import("@/services/tarefas.service");
      atualizarTarefa(
        tarefaId,
        { camposCustom: { ...(atual.camposCustom ?? {}), [acao.params.chave]: acao.params.valor } },
        autor
      );
      return { chave: acao.params.chave, valor: acao.params.valor };
    }

    default:
      throw new Error(`Tipo de ação desconhecido: ${(acao as AcaoAutomacao).tipo}`);
  }
}

async function dispararRegra(regra: Automacao, contexto: Record<string, unknown>) {
  for (const acao of regra.acoes ?? []) {
    try {
      const resultado = await executarAcao(regra, acao, contexto);
      registrarEvento({
        autor: `automacao:${regra.nome}`,
        entidade: "automacao",
        entidadeId: regra.id,
        evento: "acao_executada",
        valorNovo: {
          acao: acao.tipo,
          resultado,
          tarefaId: contexto.tarefaId ?? null,
          titulo: contexto.titulo ?? null,
        },
      });
    } catch (e) {
      registrarEvento({
        autor: `automacao:${regra.nome}`,
        entidade: "automacao",
        entidadeId: regra.id,
        evento: "falha_automacao",
        valorNovo: {
          acao: acao.tipo,
          erro: e instanceof Error ? e.message : String(e),
          tarefaId: contexto.tarefaId ?? null,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Gatilhos por evento (publicados pelo barramento)
// ---------------------------------------------------------------------------

export async function processarEvento(gatilho: string, contexto: Record<string, unknown>) {
  const regras = db
    .select()
    .from(automacoes)
    .where(eq(automacoes.ativa, true))
    .all()
    .filter((r) => r.gatilho === gatilho);

  for (const regra of regras) {
    if (!condicoesAtendidas(regra.condicoes, contexto)) continue;
    await dispararRegra(regra, contexto);
  }
}

// ---------------------------------------------------------------------------
// Gatilhos temporais (agendador ou execução manual)
// ---------------------------------------------------------------------------

function registrarDedup(automacaoId: string, chaveDedup: string): boolean {
  try {
    db.insert(execucoesAutomacao)
      .values({ automacaoId, chaveDedup, executadoEm: new Date() })
      .run();
    return true;
  } catch {
    return false; // já executada para esta chave (regra + tarefa + dia)
  }
}

export function contextoDeTarefa(t: Tarefa): Record<string, unknown> {
  const sla = avaliarSla(t);
  return {
    ...(t.camposCustom ?? {}),
    tarefaId: t.id,
    titulo: t.titulo,
    status: t.status,
    statusRotulo: ROTULO_STATUS[t.status] ?? t.status,
    responsavel: t.responsavel ?? "",
    epicoId: t.epicoId ?? "",
    prazoAtual: t.prazoAtual ? t.prazoAtual.toISOString().slice(0, 10) : "",
    prazoInicial: t.prazoInicial ? t.prazoInicial.toISOString().slice(0, 10) : "",
    diasRestantes: sla.diasRestantes ?? "",
    diasAtraso: sla.situacao === "atrasada" ? Math.abs(sla.diasRestantes ?? 0) : 0,
    situacaoSla: sla.situacao,
    repactuada: sla.repactuada,
  };
}

/**
 * Varredura temporal: tarefa_atrasada e sla_d3.
 * Cada regra dispara no máximo uma vez por tarefa por dia.
 */
export async function verificarGatilhosTemporais() {
  const regras = db
    .select()
    .from(automacoes)
    .where(eq(automacoes.ativa, true))
    .all()
    .filter((r) => r.gatilho.startsWith("tempo:"));
  if (regras.length === 0) return { disparos: 0 };

  const abertas = db.select().from(tarefas).where(ne(tarefas.status, "concluido")).all();
  const hoje = new Date().toISOString().slice(0, 10);
  let disparos = 0;

  for (const t of abertas) {
    const contexto = contextoDeTarefa(t);
    const situacao = contexto.situacaoSla as string;

    for (const regra of regras) {
      const casa =
        (regra.gatilho === "tempo:tarefa_atrasada" && situacao === "atrasada") ||
        (regra.gatilho === "tempo:sla_d3" &&
          (situacao === "atencao" ||
            (typeof contexto.diasRestantes === "number" &&
              contexto.diasRestantes >= 0 &&
              contexto.diasRestantes <= 3)));
      if (!casa) continue;
      if (!condicoesAtendidas(regra.condicoes, contexto)) continue;
      if (!registrarDedup(regra.id, `${t.id}:${hoje}`)) continue;
      await dispararRegra(regra, contexto);
      disparos++;
    }
  }
  return { disparos };
}
