import { NextResponse } from "next/server";
import { alternarAutomacao } from "@/services/automacoes.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const corpo = await req.json();
    const regra = alternarAutomacao(params.id, Boolean(corpo.ativa));
    return NextResponse.json(regra);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao atualizar regra.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
