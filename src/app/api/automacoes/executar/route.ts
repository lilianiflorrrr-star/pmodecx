import { NextResponse } from "next/server";
import { verificarGatilhosTemporais } from "@/automacao/motor";

export const dynamic = "force-dynamic";

/** Execução manual das verificações temporais, sem esperar o agendador. */
export async function POST() {
  try {
    const resultado = await verificarGatilhosTemporais();
    return NextResponse.json(resultado);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao executar verificações.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
