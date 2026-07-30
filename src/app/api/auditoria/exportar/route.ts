import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { listarEventosFiltrados } from "@/services/auditoria.service";

export const dynamic = "force-dynamic";

function filtrosDaUrl(url: URL) {
  const de = url.searchParams.get("de");
  const ate = url.searchParams.get("ate");
  return {
    de: de ? new Date(`${de}T00:00:00`) : undefined,
    ate: ate ? new Date(`${ate}T23:59:59`) : undefined,
    entidade: url.searchParams.get("entidade") || undefined,
    evento: url.searchParams.get("evento") || undefined,
    autor: url.searchParams.get("autor") || undefined,
  };
}

function linhasParaExportar(url: URL) {
  return listarEventosFiltrados(filtrosDaUrl(url)).map((e) => ({
    id: e.id,
    quando: e.ocorridoEm.toLocaleString("pt-BR"),
    autor: e.autor,
    entidade: e.entidade,
    entidade_id: e.entidadeId,
    evento: e.evento,
    valor_anterior: e.valorAnterior ? JSON.stringify(e.valorAnterior) : "",
    valor_novo: e.valorNovo ? JSON.stringify(e.valorNovo) : "",
    hash: e.hashCorrente,
  }));
}

function paraCsv(linhas: Record<string, unknown>[]): string {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]);
  const escapar = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corpo = linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";"));
  // BOM + separador ; para abrir direto no Excel em português.
  return "\ufeff" + [colunas.join(";"), ...corpo].join("\r\n");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const linhas = linhasParaExportar(url);
  const data = new Date().toISOString().slice(0, 10);

  if (formato === "xlsx") {
    const planilha = XLSX.utils.json_to_sheet(linhas);
    planilha["!cols"] = [
      { wch: 6 }, { wch: 18 }, { wch: 24 }, { wch: 16 },
      { wch: 38 }, { wch: 22 }, { wch: 50 }, { wch: 50 }, { wch: 20 },
    ];
    const pasta = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pasta, planilha, "Inventário");
    const buffer = XLSX.write(pasta, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inventario_${data}.xlsx"`,
      },
    });
  }

  return new NextResponse(paraCsv(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario_${data}.csv"`,
    },
  });
}
