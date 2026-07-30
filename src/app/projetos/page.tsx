"use client";

import { useEffect, useState } from "react";
import { ROTULO_PERFIL_PROJETO } from "@/lib/constantes";

type Projeto = {
  id: string;
  nome: string;
  perfil: "implantacao" | "acao_cx";
  sponsor: string | null;
  owner: string | null;
  descricao: string | null;
};

export default function PaginaProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<"implantacao" | "acao_cx">("implantacao");
  const [sponsor, setSponsor] = useState("");
  const [owner, setOwner] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<Projeto>>({});

  async function carregar() {
    const r = await fetch("/api/projetos");
    setProjetos(await r.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, perfil, sponsor, owner, descricao }),
      });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo.erro);
      setNome("");
      setSponsor("");
      setOwner("");
      setDescricao("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar projeto.");
    } finally {
      setSalvando(false);
    }
  }

  function abrir(p: Projeto) {
    setExpandido(expandido === p.id ? null : p.id);
    setRascunho(p);
  }

  async function salvarEdicao(id: string) {
    await fetch(`/api/projetos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: rascunho.nome,
        perfil: rascunho.perfil,
        sponsor: rascunho.sponsor,
        owner: rascunho.owner,
        descricao: rascunho.descricao,
      }),
    });
    setExpandido(null);
    await carregar();
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="kicker">Camada de governança</p>
        <h2 className="mt-1 text-2xl font-bold">Projetos</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          O nível mais alto da hierarquia: projeto → épico → tarefa. Use a descrição por
          extenso para registrar contexto, escopo e histórico — o que não cabe num campo curto.
        </p>
      </section>

      <section className="cartao space-y-4">
        <p className="text-sm font-semibold">Criar projeto</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo-form">Nome</label>
            <input
              className="campo-form"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Implantação Zendesk · Conta X"
            />
          </div>
          <div>
            <label className="rotulo-form">Perfil</label>
            <select
              className="campo-form"
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as "implantacao" | "acao_cx")}
            >
              {Object.entries(ROTULO_PERFIL_PROJETO).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo-form">Sponsor</label>
            <input
              className="campo-form"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              placeholder="Quem patrocina o projeto"
            />
          </div>
          <div>
            <label className="rotulo-form">Owner</label>
            <input
              className="campo-form"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Quem responde pelo projeto no PMO"
            />
          </div>
        </div>
        <div>
          <label className="rotulo-form">Descrição por extenso</label>
          <textarea
            className="campo-form min-h-[140px] resize-y"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Contexto, escopo, histórico, links de referência, o que for relevante para quem for consultar depois..."
          />
        </div>
        {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
        <button className="botao-primario" onClick={criar} disabled={salvando}>
          {salvando ? "Salvando..." : "Criar projeto"}
        </button>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-semibold">Projetos existentes</p>
        {projetos.length === 0 ? (
          <p className="cartao text-sm text-ink/60">
            Nenhum projeto criado ainda.
          </p>
        ) : (
          projetos.map((p) => (
            <div key={p.id} className="cartao">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => abrir(p)}
              >
                <div>
                  <p className="font-semibold">{p.nome}</p>
                  <p className="text-xs text-ink/60">
                    {ROTULO_PERFIL_PROJETO[p.perfil] ?? p.perfil}
                    {p.sponsor ? ` · Sponsor: ${p.sponsor}` : ""}
                    {p.owner ? ` · Owner: ${p.owner}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold text-brand">
                  {expandido === p.id ? "Fechar" : "Ver / editar"}
                </span>
              </button>

              {expandido === p.id ? (
                <div className="mt-4 space-y-4 border-t border-mist pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="rotulo-form">Nome</label>
                      <input
                        className="campo-form"
                        value={rascunho.nome ?? ""}
                        onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="rotulo-form">Perfil</label>
                      <select
                        className="campo-form"
                        value={rascunho.perfil ?? "implantacao"}
                        onChange={(e) =>
                          setRascunho({
                            ...rascunho,
                            perfil: e.target.value as "implantacao" | "acao_cx",
                          })
                        }
                      >
                        {Object.entries(ROTULO_PERFIL_PROJETO).map(([v, r]) => (
                          <option key={v} value={v}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="rotulo-form">Sponsor</label>
                      <input
                        className="campo-form"
                        value={rascunho.sponsor ?? ""}
                        onChange={(e) => setRascunho({ ...rascunho, sponsor: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="rotulo-form">Owner</label>
                      <input
                        className="campo-form"
                        value={rascunho.owner ?? ""}
                        onChange={(e) => setRascunho({ ...rascunho, owner: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="rotulo-form">Descrição por extenso</label>
                    <textarea
                      className="campo-form min-h-[160px] resize-y"
                      value={rascunho.descricao ?? ""}
                      onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                    />
                  </div>
                  <button className="botao-primario" onClick={() => salvarEdicao(p.id)}>
                    Salvar alterações
                  </button>
                </div>
              ) : p.descricao ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink/80">{p.descricao}</p>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
