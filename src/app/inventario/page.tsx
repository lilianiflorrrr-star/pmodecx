import { listarEventosFiltrados, verificarIntegridade } from "@/services/auditoria.service";
import { ROTULO_EVENTO } from "@/lib/constantes";
import BotaoSheets from "./BotaoSheets";

export const dynamic = "force-dynamic";

const ENTIDADES = ["tarefa", "epico", "definicao_campo", "automacao", "projeto", "sistema"];

function resumo(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  const texto = JSON.stringify(valor);
  return texto.length > 90 ? texto.slice(0, 90) + "..." : texto;
}

type Busca = { de?: string; ate?: string; entidade?: string; evento?: string; autor?: string };

export default function PaginaInventario({ searchParams }: { searchParams: Busca }) {
  const filtros = {
    de: searchParams.de ? new Date(`${searchParams.de}T00:00:00`) : undefined,
    ate: searchParams.ate ? new Date(`${searchParams.ate}T23:59:59`) : undefined,
    entidade: searchParams.entidade || undefined,
    evento: searchParams.evento || undefined,
    autor: searchParams.autor || undefined,
    limite: 200,
  };
  const eventos = listarEventosFiltrados(filtros);
  const integridade = verificarIntegridade();
  const query = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
  ).toString();
  const sufixo = query ? `&${query}` : "";

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Rastreabilidade e auditoria</p>
          <h2 className="mt-1 text-2xl font-bold">Inventário de movimentações</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            Registro imutável: o banco bloqueia UPDATE e DELETE nesta tabela por gatilho,
            e cada linha encadeia com a anterior por hash. Exibindo até 200 eventos filtrados;
            a exportação leva todos os eventos do filtro.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
            integridade.integro ? "bg-ok" : "bg-danger"
          }`}
        >
          Corrente {integridade.integro ? "íntegra" : "violada"} · {integridade.totalLinhas} linhas
        </span>
      </section>

      <section className="cartao">
        <form method="GET" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="rotulo-form">De</label>
            <input type="date" name="de" defaultValue={searchParams.de ?? ""} className="campo-form" />
          </div>
          <div>
            <label className="rotulo-form">Até</label>
            <input type="date" name="ate" defaultValue={searchParams.ate ?? ""} className="campo-form" />
          </div>
          <div>
            <label className="rotulo-form">Entidade</label>
            <select name="entidade" defaultValue={searchParams.entidade ?? ""} className="campo-form">
              <option value="">Todas</option>
              {ENTIDADES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo-form">Evento</label>
            <select name="evento" defaultValue={searchParams.evento ?? ""} className="campo-form">
              <option value="">Todos</option>
              {Object.entries(ROTULO_EVENTO).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo-form">Autor contém</label>
            <input name="autor" defaultValue={searchParams.autor ?? ""} className="campo-form" placeholder="pmo_cx, automacao, webhook" />
          </div>
          <div className="flex items-end gap-2">
            <button className="botao-primario" type="submit">Filtrar</button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="botao-discreto" href={`/api/auditoria/exportar?formato=csv${sufixo}`}>
            Exportar CSV
          </a>
          <a className="botao-discreto" href={`/api/auditoria/exportar?formato=xlsx${sufixo}`}>
            Exportar XLSX
          </a>
          <a className="botao-discreto" href="/inventario">Limpar filtros</a>
        </div>
      </section>

      <section className="cartao space-y-3">
        <p className="text-sm font-semibold">Espelho no Google Sheets</p>
        <BotaoSheets />
      </section>

      <section className="cartao overflow-x-auto">
        {eventos.length === 0 ? (
          <p className="text-sm text-ink/60">
            Nenhum evento para o filtro atual. Ajuste o período ou limpe os filtros.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-mist text-xs uppercase tracking-wide text-ink/60">
                <th className="py-2 pr-4">Quando</th>
                <th className="py-2 pr-4">Autor</th>
                <th className="py-2 pr-4">Entidade</th>
                <th className="py-2 pr-4">Evento</th>
                <th className="py-2 pr-4">Antes</th>
                <th className="py-2">Depois</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className="border-b border-paper align-top">
                  <td className="py-2 pr-4 whitespace-nowrap text-xs text-ink/70">
                    {e.ocorridoEm.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-4 text-xs">{e.autor}</td>
                  <td className="py-2 pr-4 text-xs">{e.entidade}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded-md bg-paper px-2 py-0.5 text-xs font-semibold text-ink">
                      {ROTULO_EVENTO[e.evento] ?? e.evento}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-[11px] text-ink/60">
                    {resumo(e.valorAnterior)}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-ink/60">
                    {resumo(e.valorNovo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
