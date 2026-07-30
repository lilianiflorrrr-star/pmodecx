"use client";

import { useEffect, useState } from "react";
import { ROTULO_STATUS } from "@/lib/constantes";

type Campo = {
  id: string;
  chave: string;
  rotulo: string;
  tipo: string;
  opcoes: string[] | null;
  ativa: boolean;
};

type Epico = { id: string; nome: string };

type Tarefa = {
  id: string;
  titulo: string;
  status: string;
  responsavel: string | null;
  prazoAtual: string | null;
  camposCustom: Record<string, unknown> | null;
  criadoEm: string;
};

export default function PaginaTarefas() {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [epicos, setEpicos] = useState<Epico[]>([]);
  const [epicoId, setEpicoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazoInicial, setPrazoInicial] = useState("");
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const [rc, rt, re] = await Promise.all([
      fetch("/api/campos?aplicaA=tarefa"),
      fetch("/api/tarefas"),
      fetch("/api/epicos"),
    ]);
    const todosCampos: Campo[] = await rc.json();
    setCampos(todosCampos.filter((c) => c.ativa));
    setTarefas(await rt.json());
    setEpicos(await re.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  function definirValor(chave: string, valor: unknown) {
    setValores((v) => ({ ...v, [chave]: valor }));
  }

  async function criar() {
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          responsavel,
          prazoInicial: prazoInicial || null,
          epicoId: epicoId || null,
          camposCustom: valores,
        }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro);
      setTitulo("");
      setResponsavel("");
      setPrazoInicial("");
      setValores({});
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar tarefa.");
    } finally {
      setSalvando(false);
    }
  }

  function entradaDinamica(c: Campo) {
    const valor = valores[c.chave];
    switch (c.tipo) {
      case "selecao":
        return (
          <select
            className="campo-form"
            value={(valor as string) ?? ""}
            onChange={(e) => definirValor(c.chave, e.target.value)}
          >
            <option value="">Selecionar...</option>
            {(c.opcoes ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className="flex h-9 items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={Boolean(valor)}
              onChange={(e) => definirValor(c.chave, e.target.checked)}
            />
            Sim
          </label>
        );
      case "numero":
        return (
          <input
            type="number"
            className="campo-form"
            value={(valor as string) ?? ""}
            onChange={(e) =>
              definirValor(c.chave, e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        );
      case "data":
        return (
          <input
            type="date"
            className="campo-form"
            value={(valor as string) ?? ""}
            onChange={(e) => definirValor(c.chave, e.target.value)}
          />
        );
      case "url":
        return (
          <input
            type="url"
            className="campo-form"
            placeholder="https://"
            value={(valor as string) ?? ""}
            onChange={(e) => definirValor(c.chave, e.target.value)}
          />
        );
      default:
        return (
          <input
            className="campo-form"
            value={(valor as string) ?? ""}
            onChange={(e) => definirValor(c.chave, e.target.value)}
          />
        );
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="kicker">Registro de trabalho</p>
        <h2 className="mt-1 text-2xl font-bold">Tarefas</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          O formulário abaixo monta os campos dinâmicos a partir das definições ativas.
          Toda criação grava tarefa e lastro no inventário dentro da mesma transação.
        </p>
      </section>

      <section className="cartao space-y-4">
        <p className="text-sm font-semibold">Criar tarefa</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="rotulo-form">Título</label>
            <input
              className="campo-form"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Validar cronograma macro com o time de Produto"
            />
          </div>
          <div>
            <label className="rotulo-form">Responsável</label>
            <input
              className="campo-form"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo-form">Prazo inicial</label>
            <input
              type="date"
              className="campo-form"
              value={prazoInicial}
              onChange={(e) => setPrazoInicial(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo-form">Épico</label>
            <select className="campo-form" value={epicoId} onChange={(e) => setEpicoId(e.target.value)}>
              <option value="">Sem épico</option>
              {epicos.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
          {campos.map((c) => (
            <div key={c.id}>
              <label className="rotulo-form">{c.rotulo}</label>
              {entradaDinamica(c)}
            </div>
          ))}
        </div>
        {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
        <button className="botao-primario" onClick={criar} disabled={salvando}>
          {salvando ? "Salvando..." : "Criar tarefa"}
        </button>
      </section>

      <section className="cartao">
        <p className="mb-3 text-sm font-semibold">Tarefas registradas</p>
        {tarefas.length === 0 ? (
          <p className="text-sm text-ink/60">Nenhuma tarefa registrada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {tarefas.map((t) => (
              <li key={t.id} className="rounded-lg border border-paper bg-paper/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{t.titulo}</p>
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
                    {ROTULO_STATUS[t.status] ?? t.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/60">
                  {t.responsavel ? `Responsável: ${t.responsavel}` : "Sem responsável definido"}
                  {t.prazoAtual
                    ? ` · Prazo: ${new Date(t.prazoAtual).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
                {t.camposCustom && Object.keys(t.camposCustom).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(t.camposCustom).map(([chave, valor]) => (
                      <span
                        key={chave}
                        className="rounded-md border border-mist bg-white px-2 py-0.5 text-xs text-ink/80"
                      >
                        <span className="font-semibold">{chave}</span>: {String(valor)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
