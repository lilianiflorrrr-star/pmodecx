import { NextResponse } from "next/server";
import { listarCampos, criarCampo } from "@/services/campos.service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const aplicaA = url.searchParams.get("aplicaA") as
    | "tarefa"
    | "epico"
    | "projeto"
    | null;
  return NextResponse.json(listarCampos(aplicaA ?? undefined));
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const campo = criarCampo({
      rotulo: corpo.rotulo,
      tipo: corpo.tipo,
      aplicaA: corpo.aplicaA,
      opcoes: corpo.opcoes,
      exibirNoCartao: corpo.exibirNoCartao,
    });
    return NextResponse.json(campo, { status: 201 });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao criar campo.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
