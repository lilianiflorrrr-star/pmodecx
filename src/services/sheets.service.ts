import { createHash } from "node:crypto";
import fs from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, epicos, tarefas } from "@/db/schema";
import { registrarEvento } from "./auditoria.service";
import { avaliarSla, rotuloSla } from "@/lib/sla";
import { ROTULO_EVENTO, ROTULO_STATUS } from "@/lib/constantes";

/**
 * Espelho de leitura no Google Sheets.
 *
 * O banco continua sendo a fonte da verdade: é lá que vive o inventário
 * imutável, com os gatilhos que bloqueiam UPDATE e DELETE e a corrente de
 * hash. A planilha é uma cópia de consulta, reescrita a cada sincronização —
 * editar uma célula no Sheets não altera o sistema e some na próxima
 * sincronização. Por isso a aba do inventário sai com o hash de cada linha:
 * dá para conferir a planilha contra o lastro original.
 */

const ESCOPO = "https://www.googleapis.com/auth/spreadsheets";
const ABA_TAREFAS = "Tarefas";
const ABA_INVENTARIO = "Inventário";

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/**
 * A chave da conta de serviço pode vir como JSON inteiro na variável ou como
 * caminho de arquivo. Hospedagens costumam aceitar só texto; rodando na
 * máquina do PMO, apontar para o arquivo baixado é mais simples.
 */
function credenciais(): Record<string, unknown> | null {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!bruto) return null;
  try {
    const conteudo = bruto.startsWith("{") ? bruto : fs.readFileSync(bruto, "utf8");
    return JSON.parse(conteudo);
  } catch (e) {
    console.error("[sheets] GOOGLE_SERVICE_ACCOUNT_JSON inválido:", e);
    return null;
  }
}

export function planilhaId(): string | null {
  return process.env.GOOGLE_SHEETS_ID?.trim() || null;
}

/** Sem chave ou sem ID da planilha, o espelho fica desligado (como o Slack). */
export function sincronizacaoAtiva(): boolean {
  return !!planilhaId() && !!credenciais();
}

/** E-mail da conta de serviço: é com ele que a planilha precisa ser compartilhada. */
export function emailDaConta(): string | null {
  const c = credenciais();
  return typeof c?.client_email === "string" ? c.client_email : null;
}

// ---------------------------------------------------------------------------
// Chamadas à API do Sheets
// ---------------------------------------------------------------------------

async function token(): Promise<string> {
  const auth = new GoogleAuth({ credentials: credenciais() ?? undefined, scopes: [ESCOPO] });
  const t = await auth.getAccessToken();
  if (!t) throw new Error("Não foi possível obter o token de acesso do Google.");
  return t;
}

async function chamar(
  caminho: string,
  init: { method: string; corpo?: unknown },
  acesso: string
): Promise<unknown> {
  const resposta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${caminho}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${acesso}`,
      "Content-Type": "application/json",
    },
    body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Google Sheets respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`);
  }
  return resposta.json();
}

/** Cria as abas que ainda não existirem, para a primeira sincronização funcionar. */
async function garantirAbas(id: string, acesso: string, nomes: string[]) {
  const meta = (await chamar(`${id}?fields=sheets.properties.title`, { method: "GET" }, acesso)) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const existentes = new Set((meta.sheets ?? []).map((s) => s.properties?.title));
  const faltando = nomes.filter((n) => !existentes.has(n));
  if (faltando.length === 0) return;

  await chamar(
    `${id}:batchUpdate`,
    {
      method: "POST",
      corpo: { requests: faltando.map((title) => ({ addSheet: { properties: { title } } })) },
    },
    acesso
  );
}

/** Reescreve a aba inteira: limpa e grava de novo, para não deixar linha órfã. */
async function escreverAba(id: string, acesso: string, aba: string, linhas: unknown[][]) {
  const faixa = encodeURIComponent(`${aba}!A1:ZZ`);
  await chamar(`${id}/values/${faixa}:clear`, { method: "POST", corpo: {} }, acesso);
  if (linhas.length === 0) return;
  await chamar(
    `${id}/values/${encodeURIComponent(`${aba}!A1`)}?valueInputOption=RAW`,
    { method: "PUT", corpo: { values: linhas } },
    acesso
  );
}

// ---------------------------------------------------------------------------
// Montagem das abas
// ---------------------------------------------------------------------------

function data(v: Date | null | undefined): string {
  return v ? v.toLocaleDateString("pt-BR") : "";
}

export function linhasDeTarefas(): unknown[][] {
  const nomeDoEpico = new Map(db.select().from(epicos).all().map((e) => [e.id, e.nome]));
  const lista = db.select().from(tarefas).orderBy(tarefas.status, tarefas.ordem).all();

  const cabecalho = [
    "ID", "Título", "Status", "Responsável", "Épico",
    "Prazo inicial", "Prazo atual", "Repactuada", "Situação do SLA",
    "Concluída em", "Links", "Criada em",
  ];

  return [
    cabecalho,
    ...lista.map((t) => {
      const sla = avaliarSla(t);
      return [
        t.id,
        t.titulo,
        ROTULO_STATUS[t.status] ?? t.status,
        t.responsavel ?? "",
        t.epicoId ? nomeDoEpico.get(t.epicoId) ?? "" : "",
        data(t.prazoInicial),
        data(t.prazoAtual),
        sla.repactuada ? "Sim" : "Não",
        rotuloSla(sla),
        data(t.concluidaEm),
        (t.linksExternos ?? []).map((l) => `${l.rotulo}: ${l.url}`).join(" | "),
        data(t.criadoEm),
      ];
    }),
  ];
}

export function linhasDeInventario(limite: number): unknown[][] {
  const eventos = db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limite).all();

  const cabecalho = [
    "ID", "Quando", "Autor", "Entidade", "ID da entidade",
    "Evento", "Valor anterior", "Valor novo", "Hash",
  ];

  return [
    cabecalho,
    ...eventos.map((e) => [
      e.id,
      e.ocorridoEm.toLocaleString("pt-BR"),
      e.autor,
      e.entidade,
      e.entidadeId,
      ROTULO_EVENTO[e.evento] ?? e.evento,
      e.valorAnterior ? JSON.stringify(e.valorAnterior) : "",
      e.valorNovo ? JSON.stringify(e.valorNovo) : "",
      e.hashCorrente,
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

/**
 * Impressão digital do conteúdo espelhado. O agendador roda de tempos em
 * tempos, mas só chama o Google quando algo mudou de fato: economiza a cota
 * da API e evita encher o inventário de eventos repetidos.
 */
function impressaoDigital(abas: Record<string, unknown[][]>): string {
  return createHash("sha256").update(JSON.stringify(abas)).digest("hex");
}

type ResultadoSync = {
  sincronizado: boolean;
  motivo?: string;
  tarefas?: number;
  eventos?: number;
};

/**
 * Reescreve as abas de Tarefas e Inventário na planilha configurada.
 * `forcar` ignora a impressão digital (usado pelo botão manual).
 */
export async function sincronizarPlanilha(
  autor: string,
  opcoes: { forcar?: boolean; limiteInventario?: number } = {}
): Promise<ResultadoSync> {
  const id = planilhaId();
  if (!id || !credenciais()) {
    return { sincronizado: false, motivo: "Sincronização com o Google Sheets não configurada." };
  }

  const abas = {
    [ABA_TAREFAS]: linhasDeTarefas(),
    [ABA_INVENTARIO]: linhasDeInventario(opcoes.limiteInventario ?? 5000),
  };

  const digital = impressaoDigital(abas);
  const memoria = globalThis as { __digitalSheetsCX?: string };
  if (!opcoes.forcar && memoria.__digitalSheetsCX === digital) {
    return { sincronizado: false, motivo: "Nada mudou desde a última sincronização." };
  }

  const acesso = await token();
  await garantirAbas(id, acesso, [ABA_TAREFAS, ABA_INVENTARIO]);
  for (const [aba, linhas] of Object.entries(abas)) {
    await escreverAba(id, acesso, aba, linhas);
  }
  memoria.__digitalSheetsCX = digital;

  // Cabeçalho não conta como registro.
  const totalTarefas = abas[ABA_TAREFAS].length - 1;
  const totalEventos = abas[ABA_INVENTARIO].length - 1;

  registrarEvento({
    autor,
    entidade: "sistema",
    entidadeId: id,
    evento: "sincronizacao_sheets",
    valorNovo: { tarefas: totalTarefas, eventos: totalEventos },
  });

  return { sincronizado: true, tarefas: totalTarefas, eventos: totalEventos };
}
