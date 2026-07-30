"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { COLUNAS_KANBAN } from "@/lib/constantes";
import { avaliarSla, rotuloSla, classeSla } from "@/lib/sla";

type Campo = {
  id: string;
  chave: string;
  rotulo: string;
  tipo: string;
  opcoes: string[] | null;
  exibirNoCartao: boolean;
  ativa: boolean;
};

type Epico = { id: string; nome: string };

type TarefaDTO = {
  id: string;
  epicoId: string | null;
  titulo: string;
  status: string;
  responsavel: string | null;
  prazoInicial: string | null;
  prazoAtual: string | null;
  concluidaEm: string | null;
  linksExternos: { rotulo: string; url: string }[] | null;
  camposCustom: Record<string, unknown> | null;
};

const CORES_EPICO = ["#70bcba", "#e8b2f6", "#9d6100", "#376e32", "#448af5", "#ed885f"];

function corDoEpico(epicoId: string, epicos: Epico[]) {
  const indice = epicos.findIndex((e) => e.id === epicoId);
  return CORES_EPICO[(indice < 0 ? 0 : indice) % CORES_EPICO.length];
}

// ---------------------------------------------------------------------------

function Cartao({
  tarefa,
  epicos,
  camposCartao,
  aoAbrir,
}: {
  tarefa: TarefaDTO;
  epicos: Epico[];
  camposCartao: Campo[];
  aoAbrir: (t: TarefaDTO) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarefa.id,
  });
  const sla = avaliarSla(tarefa);
  const epico = epicos.find((e) => e.id === tarefa.epicoId);
  const totalLinks = tarefa.linksExternos?.length ?? 0;

  const estilo = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={estilo}
      {...listeners}
      {...attributes}
      onClick={() => aoAbrir(tarefa)}
      className={`cursor-grab rounded-lg border border-mist bg-white p-3 shadow-sm transition hover:border-sky ${
        isDragging ? "opacity-80 shadow-lg" : ""
      }`}
    >
      {epico && (
        <span
          className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: corDoEpico(epico.id, epicos) }}
        >
          {epico.nome}
        </span>
      )}
      <p className="text-sm font-semibold leading-snug">{tarefa.titulo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${classeSla(sla)}`}>
          {rotuloSla(sla)}
        </span>
        {totalLinks > 0 && (
          <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold text-ink/70">
            {totalLinks} link{totalLinks > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {(tarefa.responsavel || camposCartao.length > 0) && (
        <div className="mt-2 space-y-0.5 text-[11px] text-ink/60">
          {tarefa.responsavel && <p>Responsável: {tarefa.responsavel}</p>}
          {camposCartao.map((c) => {
            const valor = tarefa.camposCustom?.[c.chave];
            if (valor === undefined || valor === "") return null;
            return (
              <p key={c.id}>
                {c.rotulo}: <span className="font-medium text-ink/80">{String(valor)}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Coluna({
  coluna,
  tarefas,
  epicos,
  camposCartao,
  aoAbrir,
}: {
  coluna: { id: string; rotulo: string };
  tarefas: TarefaDTO[];
  epicos: Epico[];
  camposCartao: Campo[];
  aoAbrir: (t: TarefaDTO) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition ${
        isOver ? "border-sky bg-white" : "border-mist bg-white/60"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/70">{coluna.rotulo}</p>
        <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-ink/60">
          {tarefas.length}
        </span>
      </div>
      <div className="flex min-h-24 flex-col gap-2">
        {tarefas.map((t) => (
          <Cartao
            key={t.id}
            tarefa={t}
            epicos={epicos}
            camposCartao={camposCartao}
            aoAbrir={aoAbrir}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PainelEdicao({
  tarefa,
  campos,
  epicos,
  aoFechar,
  aoSalvo,
  aoCriarEpico,
}: {
  tarefa: TarefaDTO;
  campos: Campo[];
  epicos: Epico[];
  aoFechar: () => void;
  aoSalvo: () => void;
  aoCriarEpico: (nome: string) => Promise<Epico | null>;
}) {
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [responsavel, setResponsavel] = useState(tarefa.responsavel ?? "");
  const [epicoId, setEpicoId] = useState(tarefa.epicoId ?? "");
  const [prazoAtual, setPrazoAtual] = useState(tarefa.prazoAtual?.slice(0, 10) ?? "");
  const [links, setLinks] = useState<{ rotulo: string; url: string }[]>(
    tarefa.linksExternos ?? []
  );
  const [valores, setValores] = useState<Record<string, unknown>>(tarefa.camposCustom ?? {});
  const [novoEpico, setNovoEpico] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const prazoInicialTexto = tarefa.prazoInicial
    ? new Date(tarefa.prazoInicial).toLocaleDateString("pt-BR")
    : null;
  const repactuando =
    !!tarefa.prazoInicial && prazoAtual !== (tarefa.prazoInicial?.slice(0, 10) ?? "");

  function definirValor(chave: string, valor: unknown) {
    setValores((v) => ({ ...v, [chave]: valor }));
  }

  async function criarEpicoRapido() {
    if (!novoEpico.trim()) return;
    const epico = await aoCriarEpico(novoEpico.trim());
    if (epico) {
      setEpicoId(epico.id);
      setNovoEpico("");
    }
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(`/api/tarefas/${tarefa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          responsavel,
          epicoId: epicoId || null,
          prazoAtual: prazoAtual || null,
          linksExternos: links,
          camposCustom: valores,
        }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro);
      aoSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
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
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/40" onClick={aoFechar}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-paper p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="kicker">Edição rápida</p>
          <button className="botao-discreto" onClick={aoFechar}>Fechar</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="rotulo-form">Título</label>
            <input className="campo-form" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
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
            <label className="rotulo-form">Épico</label>
            <select className="campo-form" value={epicoId} onChange={(e) => setEpicoId(e.target.value)}>
              <option value="">Sem épico</option>
              {epicos.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                className="campo-form"
                placeholder="Criar épico novo..."
                value={novoEpico}
                onChange={(e) => setNovoEpico(e.target.value)}
              />
              <button className="botao-discreto whitespace-nowrap" onClick={criarEpicoRapido}>
                Criar
              </button>
            </div>
          </div>

          <div>
            <label className="rotulo-form">Prazo atual</label>
            <input
              type="date"
              className="campo-form"
              value={prazoAtual}
              onChange={(e) => setPrazoAtual(e.target.value)}
            />
            {prazoInicialTexto && (
              <p className={`mt-1 text-xs ${repactuando ? "font-semibold text-ember" : "text-ink/60"}`}>
                Prazo inicial (congelado): {prazoInicialTexto}
                {repactuando ? " · esta alteração será registrada como repactuação" : ""}
              </p>
            )}
          </div>

          <div>
            <label className="rotulo-form">Links de referência</label>
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="campo-form"
                    placeholder="Rótulo"
                    value={l.rotulo}
                    onChange={(e) =>
                      setLinks(links.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))
                    }
                  />
                  <input
                    className="campo-form"
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) =>
                      setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                    }
                  />
                  <button
                    className="botao-discreto"
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                className="botao-discreto"
                onClick={() => setLinks([...links, { rotulo: "", url: "" }])}
              >
                Adicionar link
              </button>
            </div>
          </div>

          {campos.map((c) => (
            <div key={c.id}>
              <label className="rotulo-form">{c.rotulo}</label>
              {entradaDinamica(c)}
            </div>
          ))}

          {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
          <button className="botao-primario w-full" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function PaginaKanban() {
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [epicos, setEpicos] = useState<Epico[]>([]);
  const [editando, setEditando] = useState<TarefaDTO | null>(null);
  const [filtroEpico, setFiltroEpico] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const carregar = useCallback(async () => {
    const [rt, rc, re] = await Promise.all([
      fetch("/api/tarefas"),
      fetch("/api/campos?aplicaA=tarefa"),
      fetch("/api/epicos"),
    ]);
    setTarefas(await rt.json());
    const todosCampos: Campo[] = await rc.json();
    setCampos(todosCampos.filter((c) => c.ativa));
    setEpicos(await re.json());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const camposCartao = useMemo(() => campos.filter((c) => c.exibirNoCartao), [campos]);

  const visiveis = useMemo(
    () => (filtroEpico ? tarefas.filter((t) => t.epicoId === filtroEpico) : tarefas),
    [tarefas, filtroEpico]
  );

  const atrasadas = useMemo(
    () => visiveis.filter((t) => avaliarSla(t).situacao === "atrasada").length,
    [visiveis]
  );

  async function aoSoltar(e: DragEndEvent) {
    const tarefaId = String(e.active.id);
    const novoStatus = e.over ? String(e.over.id) : null;
    if (!novoStatus) return;
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa || tarefa.status === novoStatus) return;

    // Atualização otimista para o quadro responder na hora.
    setTarefas((lista) =>
      lista.map((t) => (t.id === tarefaId ? { ...t, status: novoStatus } : t))
    );
    const r = await fetch(`/api/tarefas/${tarefaId}/mover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novoStatus }),
    });
    // Recarrega para refletir concluidaEm e eventuais eventos de atraso.
    if (r.ok) await carregar();
    else await carregar();
  }

  async function criarEpicoRapido(nome: string): Promise<Epico | null> {
    const r = await fetch("/api/epicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!r.ok) return null;
    const epico = await r.json();
    setEpicos((e) => [...e, epico]);
    return epico;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Presença no dado</p>
          <h2 className="mt-1 text-2xl font-bold">Quadro Kanban</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            Arraste os cartões entre colunas para mudar o status. Clique em um cartão para
            editar qualquer informação. Toda movimentação gera lastro no inventário.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atrasadas > 0 && (
            <span className="rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">
              {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
            </span>
          )}
          <select
            className="campo-form w-52"
            value={filtroEpico}
            onChange={(e) => setFiltroEpico(e.target.value)}
          >
            <option value="">Todos os épicos</option>
            {epicos.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
      </section>

      <DndContext sensors={sensors} onDragEnd={aoSoltar}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS_KANBAN.map((coluna) => (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              tarefas={visiveis.filter((t) => t.status === coluna.id)}
              epicos={epicos}
              camposCartao={camposCartao}
              aoAbrir={setEditando}
            />
          ))}
        </div>
      </DndContext>

      {editando && (
        <PainelEdicao
          tarefa={editando}
          campos={campos}
          epicos={epicos}
          aoFechar={() => setEditando(null)}
          aoSalvo={async () => {
            setEditando(null);
            await carregar();
          }}
          aoCriarEpico={criarEpicoRapido}
        />
      )}
    </div>
  );
}
