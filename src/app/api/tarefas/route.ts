import { NextResponse } from "next/server";
import { listarTarefas, criarTarefa } from "@/services/tarefas.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listarTarefas());
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const tarefa = criarTarefa({
      titulo: corpo.titulo,
      responsavel: corpo.responsavel,
      prazoInicial: corpo.prazoInicial,
      camposCustom: corpo.camposCustom,
    });
    return NextResponse.json(tarefa, { status: 201 });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao criar tarefa.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
