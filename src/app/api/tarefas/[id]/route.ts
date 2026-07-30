import { NextResponse } from "next/server";
import { atualizarTarefa } from "@/services/tarefas.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const corpo = await req.json();
    const tarefa = atualizarTarefa(params.id, corpo);
    return NextResponse.json(tarefa);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao atualizar tarefa.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
