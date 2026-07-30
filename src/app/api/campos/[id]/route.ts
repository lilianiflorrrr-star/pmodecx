import { NextResponse } from "next/server";
import { alternarCampo } from "@/services/campos.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const corpo = await req.json();
    const campo = alternarCampo(params.id, Boolean(corpo.ativa));
    return NextResponse.json(campo);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao atualizar campo.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
