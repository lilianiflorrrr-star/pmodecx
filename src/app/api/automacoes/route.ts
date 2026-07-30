import { NextResponse } from "next/server";
import { listarAutomacoes, criarAutomacao } from "@/services/automacoes.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listarAutomacoes());
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const regra = criarAutomacao({
      nome: corpo.nome,
      gatilho: corpo.gatilho,
      condicoes: corpo.condicoes,
      acoes: corpo.acoes,
    });
    return NextResponse.json(regra, { status: 201 });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao criar regra.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
