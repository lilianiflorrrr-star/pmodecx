"use client";

import { useEffect, useState } from "react";
import { COLUNAS_KANBAN } from "@/lib/constantes";

type Condicao = { campo: string; operador: string; valor: string };
type Acao = { tipo: string; params: Record<string, string> };
type Regra = {
  id: string;
  nome: string;
  ativa: boolean;
  gatilho: string;
  condicoes: Condicao[] | null;
  acoes: Acao[] | null;
};
type Campo = { id: string; chave: string; rotulo: string; ativa: boolean };

const ROTULO_GATILHO: Record<string, string> = {
  "evento:tarefa_criada": "Quando uma tarefa é criada",
  "evento:mudanca_status": "Quando o status muda",
  "evento:troca_responsavel": "Quando o responsável muda",
  "evento:repactuacao_prazo": "Quando um prazo é repactuado",
  "evento:entrega_atrasada": "Quando uma entrega é concluída fora do prazo",
  "evento:campo_alterado": "Quando um campo é alterado",
  "tempo:tarefa_atrasada": "Diariamente: tarefa em atraso",
  "tempo:sla_d3": "Diariamente: tarefa vencendo em até 3 dias",
};

const ROTULO_ACAO: Record<string, string> = {
  slack: "Enviar mensagem no Slack",
  webhook: "Chamar webhook externo",
  mover_status: "Mover a tarefa de status",
  atualizar_campo: "Atualizar um campo da tarefa",
};

const OPERADORES: Record<string, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  contem: "contém",
  maior: "é maior que",
  menor: "é menor que",
};

const CAMPOS_CONTEXTO = [
  "status",
  "responsavel",
  "epicoId",
  "diasRestantes",
  "diasAtraso",
  "situacaoSla",
  "repactuada",
];

const VARIAVEIS_TEMPLATE =
  "{{titulo}} {{statusRotulo}} {{responsavel}} {{prazoAtual}} {{diasAtraso}} {{diasRestantes}}";

export default function PaginaAutomacoes() {
  const [regras, setRegras] = useState<Regra[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [nome, setNome] = useState("");
  const [gatilho, setGatilho] = useState("tempo:tarefa_atrasada");
  const [condicoes, setCondicoes] = useState<Condicao[]>([]);
  const [acoes, setAcoes] = useState<Acao[]>([{ tipo: "slack", params: {} }]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [executando, setExecutando] = useState(false);

  async function carregar() {
    const [rr, rc] = await Promise.all([
      fetch("/api/automacoes"),
      fetch("/api/campos?aplicaA=tarefa"),
    ]);
    setRegras(await rr.json());
    const todosCampos: Campo[] = await rc.json();
    setCampos(todosCampos.filter((c) => c.ativa));
  }

  useEffect(() => {
    carregar();
  }, []);

  function definirAcao(i: number, mudanca: Partial<Acao>) {
    setAcoes(acoes.map((a, j) => (j === i ? { ...a, ...mudanca } : a)));
  }

  function definirParam(i: number, chave: string, valor: string) {
    setAcoes(
      acoes.map((a, j) => (j === i ? { ...a, params: { ...a.params, [chave]: valor } } : a))
    );
  }

  async function criar() {
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/automacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, gatilho, condicoes, acoes }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro);
      setNome("");
      setCondicoes([]);
      setAcoes([{ tipo: "slack", params: {} }]);
      await carregar();
      setAviso("Regra criada. Gatilhos temporais podem ser testados com o botão de execução manual.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar regra.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(regra: Regra) {
    await fetch(`/api/automacoes/${regra.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !regra.ativa }),
    });
    await carregar();
  }

  async function executarAgora() {
    setExecutando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/automacoes/executar", { method: "POST" });
      const corpo = await r.json();
      setAviso(
        `Verificação temporal executada: ${corpo.disparos ?? 0} disparo(s). O detalhe fica no Inventário.`
      );
    } finally {
      setExecutando(false);
    }
  }

  function paramsDaAcao(a: Acao, i: number) {
    switch (a.tipo) {
      case "slack":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="rotulo-form">Mensagem (variáveis: {VARIAVEIS_TEMPLATE})</label>
              <input
                className="campo-form"
                placeholder="Atrasada: {{titulo}} ({{diasAtraso}} dias, responsável {{responsavel}})"
                value={a.params.mensagem ?? ""}
                onChange={(e) => definirParam(i, "mensagem", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo-form">Webhook do canal (vazio usa o SLACK_WEBHOOK do .env)</label>
              <input
                className="campo-form"
                placeholder="https://hooks.slack.com/services/..."
                value={a.params.webhookUrl ?? ""}
                onChange={(e) => definirParam(i, "webhookUrl", e.target.value)}
              />
            </div>
          </div>
        );
      case "webhook":
        return (
          <div>
            <label className="rotulo-form">URL de destino (recebe a regra e o contexto em JSON)</label>
            <input
              className="campo-form"
              placeholder="https://..."
              value={a.params.url ?? ""}
              onChange={(e) => definirParam(i, "url", e.target.value)}
            />
          </div>
        );
      case "mover_status":
        return (
          <div>
            <label className="rotulo-form">Mover para</label>
            <select
              className="campo-form"
              value={a.params.status ?? ""}
              onChange={(e) => definirParam(i, "status", e.target.value)}
            >
              <option value="">Selecionar...</option>
              {COLUNAS_KANBAN.map((c) => (
                <option key={c.id} value={c.id}>{c.rotulo}</option>
              ))}
            </select>
          </div>
        );
      case "atualizar_campo":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="rotulo-form">Campo</label>
              <select
                className="campo-form"
                value={a.params.chave ?? ""}
                onChange={(e) => definirParam(i, "chave", e.target.value)}
              >
                <option value="">Selecionar...</option>
                {campos.map((c) => (
                  <option key={c.id} value={c.chave}>{c.rotulo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo-form">Valor</label>
              <input
                className="campo-form"
                value={a.params.valor ?? ""}
                onChange={(e) => definirParam(i, "valor", e.target.value)}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Presença na resposta</p>
          <h2 className="mt-1 text-2xl font-bold">Automações</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            Regras de gatilho, condição e ação criadas aqui, sem código. Gatilhos por evento
            disparam na hora; gatilhos diários rodam no expediente (uma vez por tarefa por dia)
            e toda ação automática assina o Inventário como autor.
          </p>
        </div>
        <button className="botao-discreto" onClick={executarAgora} disabled={executando}>
          {executando ? "Executando..." : "Executar verificações temporais agora"}
        </button>
      </section>

      {aviso && (
        <p className="rounded-lg border border-mist bg-white px-4 py-2 text-sm text-ink/80">{aviso}</p>
      )}

      <section className="cartao space-y-5">
        <p className="text-sm font-semibold">Criar regra</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo-form">Nome da regra</label>
            <input
              className="campo-form"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Alerta diário de atraso no canal do PMO"
            />
          </div>
          <div>
            <label className="rotulo-form">Gatilho</label>
            <select className="campo-form" value={gatilho} onChange={(e) => setGatilho(e.target.value)}>
              {Object.entries(ROTULO_GATILHO).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="rotulo-form">Condições (todas precisam ser verdadeiras; vazio dispara sempre)</p>
          <div className="space-y-2">
            {condicoes.map((c, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select
                  className="campo-form w-44"
                  value={c.campo}
                  onChange={(e) =>
                    setCondicoes(condicoes.map((x, j) => (j === i ? { ...x, campo: e.target.value } : x)))
                  }
                >
                  <option value="">Campo...</option>
                  {CAMPOS_CONTEXTO.map((cc) => (
                    <option key={cc} value={cc}>{cc}</option>
                  ))}
                  {campos.map((cc) => (
                    <option key={cc.id} value={cc.chave}>{cc.rotulo} (campo)</option>
                  ))}
                </select>
                <select
                  className="campo-form w-40"
                  value={c.operador}
                  onChange={(e) =>
                    setCondicoes(condicoes.map((x, j) => (j === i ? { ...x, operador: e.target.value } : x)))
                  }
                >
                  {Object.entries(OPERADORES).map(([v, r]) => (
                    <option key={v} value={v}>{r}</option>
                  ))}
                </select>
                <input
                  className="campo-form w-44"
                  placeholder="Valor"
                  value={c.valor}
                  onChange={(e) =>
                    setCondicoes(condicoes.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))
                  }
                />
                <button
                  className="botao-discreto"
                  onClick={() => setCondicoes(condicoes.filter((_, j) => j !== i))}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              className="botao-discreto"
              onClick={() => setCondicoes([...condicoes, { campo: "", operador: "igual", valor: "" }])}
            >
              Adicionar condição
            </button>
          </div>
        </div>

        <div>
          <p className="rotulo-form">Ações</p>
          <div className="space-y-3">
            {acoes.map((a, i) => (
              <div key={i} className="rounded-lg border border-mist bg-paper/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <select
                    className="campo-form w-64"
                    value={a.tipo}
                    onChange={(e) => definirAcao(i, { tipo: e.target.value, params: {} })}
                  >
                    {Object.entries(ROTULO_ACAO).map(([v, r]) => (
                      <option key={v} value={v}>{r}</option>
                    ))}
                  </select>
                  {acoes.length > 1 && (
                    <button
                      className="botao-discreto"
                      onClick={() => setAcoes(acoes.filter((_, j) => j !== i))}
                    >
                      Remover
                    </button>
                  )}
                </div>
                {paramsDaAcao(a, i)}
              </div>
            ))}
            <button
              className="botao-discreto"
              onClick={() => setAcoes([...acoes, { tipo: "slack", params: {} }])}
            >
              Adicionar ação
            </button>
          </div>
        </div>

        {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
        <button className="botao-primario" onClick={criar} disabled={salvando}>
          {salvando ? "Salvando..." : "Criar regra"}
        </button>
      </section>

      <section className="cartao">
        <p className="mb-3 text-sm font-semibold">Regras existentes</p>
        {regras.length === 0 ? (
          <p className="text-sm text-ink/60">
            Nenhuma regra criada ainda. Sugestão inicial: gatilho diário de tarefa em atraso
            com mensagem no Slack do canal do PMO.
          </p>
        ) : (
          <ul className="space-y-2">
            {regras.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper bg-paper/60 p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{r.nome}</p>
                  <p className="text-xs text-ink/60">
                    {ROTULO_GATILHO[r.gatilho] ?? r.gatilho} ·{" "}
                    {(r.condicoes?.length ?? 0)} condição(ões) ·{" "}
                    {(r.acoes ?? []).map((a) => ROTULO_ACAO[a.tipo] ?? a.tipo).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${
                      r.ativa ? "bg-ok" : "bg-ember"
                    }`}
                  >
                    {r.ativa ? "Ativa" : "Desativada"}
                  </span>
                  <button className="botao-discreto" onClick={() => alternar(r)}>
                    {r.ativa ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
