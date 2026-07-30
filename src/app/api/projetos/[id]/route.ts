import { NextResponse } from "next/server";
import { atualizarProjeto } from "@/services/projetos.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const corpo = await req.json();
    const projeto = atualizarProjeto(params.id, corpo);
    return NextResponse.json(projeto);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao atualizar projeto.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
