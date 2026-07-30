"use client";

import { useEffect, useState } from "react";
import { ROTULO_TIPO_CAMPO } from "@/lib/constantes";

type Campo = {
  id: string;
  chave: string;
  rotulo: string;
  tipo: string;
  opcoes: string[] | null;
  aplicaA: string;
  exibirNoCartao: boolean;
  ativa: boolean;
};

const APLICA_A: Record<string, string> = {
  tarefa: "Tarefa",
  epico: "Épico",
  projeto: "Projeto",
};

export default function PaginaCampos() {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [rotulo, setRotulo] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [aplicaA, setAplicaA] = useState("tarefa");
  const [opcoes, setOpcoes] = useState("");
  const [exibirNoCartao, setExibirNoCartao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const r = await fetch("/api/campos");
    setCampos(await r.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/campos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rotulo,
          tipo,
          aplicaA,
          exibirNoCartao,
          opcoes:
            tipo === "selecao"
              ? opcoes.split(",").map((o) => o.trim()).filter(Boolean)
              : undefined,
        }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro);
      setRotulo("");
      setOpcoes("");
      setExibirNoCartao(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar campo.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(campo: Campo) {
    await fetch(`/api/campos/${campo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !campo.ativa }),
    });
    await carregar();
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="kicker">Fluidez de informação</p>
        <h2 className="mt-1 text-2xl font-bold">Campos dinâmicos</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          Campos criados aqui ficam disponíveis na hora nos formulários, sem migração de banco
          e sem deploy. Campos não são excluídos, apenas desativados, preservando o significado
          dos valores históricos no inventário.
        </p>
      </section>

      <section className="cartao space-y-4">
        <p className="text-sm font-semibold">Criar campo</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo-form">Rótulo</label>
            <input
              className="campo-form"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Ex: Área parceira, Critical Score, Canal de reporte"
            />
          </div>
          <div>
            <label className="rotulo-form">Tipo</label>
            <select className="campo-form" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(ROTULO_TIPO_CAMPO).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo-form">Aplica a</label>
            <select className="campo-form" value={aplicaA} onChange={(e) => setAplicaA(e.target.value)}>
              {Object.entries(APLICA_A).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
          {tipo === "selecao" && (
            <div>
              <label className="rotulo-form">Opções (separadas por vírgula)</label>
              <input
                className="campo-form"
                value={opcoes}
                onChange={(e) => setOpcoes(e.target.value)}
                placeholder="Ex: Tech, Produto, Vendas"
              />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={exibirNoCartao}
            onChange={(e) => setExibirNoCartao(e.target.checked)}
          />
          Exibir este campo no cartão do Kanban (a partir da Fase 2)
        </label>
        {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
        <button className="botao-primario" onClick={criar} disabled={salvando}>
          {salvando ? "Salvando..." : "Criar campo"}
        </button>
      </section>

      <section className="cartao">
        <p className="mb-3 text-sm font-semibold">Campos existentes</p>
        {campos.length === 0 ? (
          <p className="text-sm text-ink/60">
            Nenhum campo criado ainda. O primeiro campo que você criar aqui aparece
            imediatamente no formulário de tarefas.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mist text-xs uppercase tracking-wide text-ink/60">
                <th className="py-2 pr-4">Rótulo</th>
                <th className="py-2 pr-4">Chave</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Aplica a</th>
                <th className="py-2 pr-4">Situação</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {campos.map((c) => (
                <tr key={c.id} className="border-b border-paper">
                  <td className="py-2 pr-4 font-medium">{c.rotulo}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-ink/60">{c.chave}</td>
                  <td className="py-2 pr-4">{ROTULO_TIPO_CAMPO[c.tipo] ?? c.tipo}</td>
                  <td className="py-2 pr-4">{APLICA_A[c.aplicaA] ?? c.aplicaA}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${
                        c.ativa ? "bg-ok" : "bg-ember"
                      }`}
                    >
                      {c.ativa ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button className="botao-discreto" onClick={() => alternar(c)}>
                      {c.ativa ? "Desativar" : "Reativar"}
                    </button>
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
