import { NextResponse } from "next/server";
import { moverTarefa } from "@/services/tarefas.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const corpo = await req.json();
    const tarefa = moverTarefa(params.id, corpo.novoStatus);
    return NextResponse.json(tarefa);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao mover tarefa.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
