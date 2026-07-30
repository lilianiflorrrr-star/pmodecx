import { NextResponse } from "next/server";
import { listarEventos, verificarIntegridade } from "@/services/auditoria.service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("verificar") === "1") {
    return NextResponse.json(verificarIntegridade());
  }
  return NextResponse.json(listarEventos());
}
