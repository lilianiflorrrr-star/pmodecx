/**
 * Barramento de eventos interno.
 * Os serviços publicam aqui após a transação ser confirmada; o motor de
 * automações consome de forma assíncrona. O import dinâmico evita ciclo
 * de dependência (motor usa serviços, serviços usam o barramento).
 *
 * Trava de governança: eventos cujo autor começa com "automacao" não
 * disparam novas automações, impedindo cascatas e loops.
 */
export function publicar(evento: string, contexto: Record<string, unknown>) {
  setImmediate(async () => {
    try {
      const autor = String(contexto.autor ?? "");
      if (autor.startsWith("automacao")) return;
      const { processarEvento } = await import("./motor");
      await processarEvento(`evento:${evento}`, contexto);
    } catch (e) {
      console.error("[automação] falha ao processar evento:", e);
    }
  });
}
