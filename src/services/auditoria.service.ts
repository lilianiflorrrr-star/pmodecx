import { createHash } from "node:crypto";
import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

/**
 * Único ponto de escrita do log de auditoria.
 * Cada linha carrega um hash que encadeia com a linha anterior:
 * adulteração retroativa quebra a corrente e fica evidente.
 */
export function registrarEvento(params: {
  autor: string;
  entidade: string;
  entidadeId: string;
  evento: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
}) {
  const [ultimo] = db
    .select({ hash: auditLog.hashCorrente })
    .from(auditLog)
    .orderBy(desc(auditLog.id))
    .limit(1)
    .all();

  const ocorridoEm = new Date();
  const hashCorrente = createHash("sha256")
    .update(
      JSON.stringify({
        anterior: ultimo?.hash ?? "genesis",
        autor: params.autor,
        entidade: params.entidade,
        entidadeId: params.entidadeId,
        evento: params.evento,
        valorAnterior: params.valorAnterior ?? null,
        valorNovo: params.valorNovo ?? null,
        ocorridoEm: ocorridoEm.getTime(),
      })
    )
    .digest("hex");

  db.insert(auditLog)
    .values({
      ocorridoEm,
      autor: params.autor,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      evento: params.evento,
      valorAnterior: params.valorAnterior ?? null,
      valorNovo: params.valorNovo ?? null,
      hashCorrente,
    })
    .run();
}

export function listarEventos(limite = 200) {
  return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limite).all();
}

export type FiltrosAuditoria = {
  de?: Date;
  ate?: Date;
  entidade?: string;
  evento?: string;
  autor?: string;
  limite?: number;
};

export function listarEventosFiltrados(f: FiltrosAuditoria) {
  const condicoes = [];
  if (f.de) condicoes.push(gte(auditLog.ocorridoEm, f.de));
  if (f.ate) condicoes.push(lte(auditLog.ocorridoEm, f.ate));
  if (f.entidade) condicoes.push(eq(auditLog.entidade, f.entidade));
  if (f.evento) condicoes.push(eq(auditLog.evento, f.evento));
  if (f.autor) condicoes.push(like(auditLog.autor, `%${f.autor}%`));
  return db
    .select()
    .from(auditLog)
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(f.limite ?? 5000)
    .all();
}

/** Percorre a corrente e confirma que nenhuma linha foi adulterada. */
export function verificarIntegridade(): { integro: boolean; totalLinhas: number } {
  const linhas = db.select().from(auditLog).orderBy(auditLog.id).all();
  let anterior = "genesis";
  for (const l of linhas) {
    const esperado = createHash("sha256")
      .update(
        JSON.stringify({
          anterior,
          autor: l.autor,
          entidade: l.entidade,
          entidadeId: l.entidadeId,
          evento: l.evento,
          valorAnterior: l.valorAnterior ?? null,
          valorNovo: l.valorNovo ?? null,
          ocorridoEm: l.ocorridoEm.getTime(),
        })
      )
      .digest("hex");
    if (esperado !== l.hashCorrente) return { integro: false, totalLinhas: linhas.length };
    anterior = l.hashCorrente;
  }
  return { integro: true, totalLinhas: linhas.length };
}
