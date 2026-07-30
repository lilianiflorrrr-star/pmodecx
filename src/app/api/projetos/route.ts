import { NextResponse } from "next/server";
import { listarProjetos, criarProjeto } from "@/services/projetos.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listarProjetos());
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json();
    const projeto = criarProjeto({
      nome: corpo.nome,
      perfil: corpo.perfil,
      sponsor: corpo.sponsor,
      owner: corpo.owner,
      descricao: corpo.descricao,
    });
    return NextResponse.json(projeto, { status: 201 });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao criar projeto.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
