import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { criarTarefa } from "@/services/tarefas.service";

export const dynamic = "force-dynamic";

function chaveValida(recebida: string | null): boolean {
  const esperada = process.env.API_KEY;
  if (!esperada || !recebida) return false;
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Porta de entrada para sistemas externos criarem tarefas
 * (formulários de solicitação, integrações, scripts).
 * Autenticação por chave no cabeçalho x-api-key.
 * O autor fica registrado como "webhook:origem" no inventário.
 */
export async function POST(req: Request) {
  if (!process.env.API_KEY) {
    return NextResponse.json(
      { erro: "Webhook desabilitado: defina API_KEY no .env para ativar a entrada externa." },
      { status: 503 }
    );
  }
  if (!chaveValida(req.headers.get("x-api-key"))) {
    return NextResponse.json({ erro: "Chave de API inválida." }, { status: 401 });
  }

  try {
    const corpo = await req.json();
    const origem = String(corpo.origem ?? "externo")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .slice(0, 40);

    const tarefa = criarTarefa({
      titulo: corpo.titulo,
      responsavel: corpo.responsavel,
      prazoInicial: corpo.prazoInicial,
      epicoId: corpo.epicoId,
      camposCustom: corpo.camposCustom,
      autor: `webhook:${origem || "externo"}`,
    });
    return NextResponse.json({ id: tarefa.id, titulo: tarefa.titulo }, { status: 201 });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro ao criar tarefa via webhook.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }
}
