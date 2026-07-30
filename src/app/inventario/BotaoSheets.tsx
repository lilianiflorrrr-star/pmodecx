"use client";

import { useEffect, useState } from "react";

type Estado = { ativa: boolean; planilhaId: string | null; contaDeServico: string | null };

/**
 * Espelho no Google Sheets: estado da configuração e sincronização manual.
 * Desconfigurado, o bloco explica o que falta em vez de sumir da tela.
 */
export default function BotaoSheets() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sheets/sincronizar")
      .then((r) => r.json())
      .then(setEstado)
      .catch(() => setEstado({ ativa: false, planilhaId: null, contaDeServico: null }));
  }, []);

  async function sincronizar() {
    setSincronizando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/sheets/sincronizar", { method: "POST" });
      const corpo = await r.json();
      setAviso(
        r.ok
          ? `Planilha atualizada: ${corpo.tarefas ?? 0} tarefa(s) e ${corpo.eventos ?? 0} evento(s).`
          : `Não foi possível sincronizar: ${corpo.erro}`
      );
    } catch (e) {
      setAviso(`Não foi possível sincronizar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSincronizando(false);
    }
  }

  if (!estado) return null;

  if (!estado.ativa) {
    return (
      <p className="rounded-lg border border-mist bg-white px-4 py-2 text-sm text-ink/70">
        Espelho no Google Sheets desligado. Preencha <code>GOOGLE_SHEETS_ID</code> e{" "}
        <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> no arquivo <code>.env</code> e reinicie o
        servidor. O passo a passo está no README.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className="botao-discreto" onClick={sincronizar} disabled={sincronizando}>
          {sincronizando ? "Sincronizando..." : "Sincronizar planilha agora"}
        </button>
        <a
          className="botao-discreto"
          href={`https://docs.google.com/spreadsheets/d/${estado.planilhaId}/edit`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir planilha
        </a>
        <span className="text-xs text-ink/60">
          Atualiza sozinha a cada 10 min no expediente. A planilha é cópia de consulta: editar
          lá não altera o sistema.
        </span>
      </div>
      {aviso && (
        <p className="rounded-lg border border-mist bg-white px-4 py-2 text-sm text-ink/80">
          {aviso}
        </p>
      )}
    </div>
  );
}
