import { NextResponse } from "next/server";
import { listarEpicos, criarEpico } from "@/services/epicos.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listarEpicos());
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const epico = criarEpico({ nome: corpo.nome, descricao: corpo.descricao });
    return NextResponse.json(epico, { status: 201 });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao criar épico.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
