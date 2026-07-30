import { NextResponse } from "next/server";
import { AUTOR_PADRAO } from "@/lib/constantes";
import {
  emailDaConta,
  planilhaId,
  sincronizacaoAtiva,
  sincronizarPlanilha,
} from "@/services/sheets.service";

export const dynamic = "force-dynamic";

/** Estado da configuração, para a tela mostrar o que ainda falta. */
export async function GET() {
  return NextResponse.json({
    ativa: sincronizacaoAtiva(),
    planilhaId: planilhaId(),
    contaDeServico: emailDaConta(),
  });
}

/** Sincronização manual: sempre reescreve, mesmo se nada mudou. */
export async function POST() {
  if (!sincronizacaoAtiva()) {
    return NextResponse.json(
      { erro: "Configure GOOGLE_SHEETS_ID e GOOGLE_SERVICE_ACCOUNT_JSON no .env." },
      { status: 400 }
    );
  }
  try {
    const r = await sincronizarPlanilha(AUTOR_PADRAO, { forcar: true });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
