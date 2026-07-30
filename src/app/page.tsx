import Link from "next/link";
import { db } from "@/db/client";
import { tarefas, definicoesCampos, auditLog } from "@/db/schema";
import { verificarIntegridade } from "@/services/auditoria.service";
import { avaliarSla } from "@/lib/sla";

export const dynamic = "force-dynamic";

export default function Painel() {
  const todasTarefas = db.select().from(tarefas).all();
  const totalTarefas = todasTarefas.length;
  const totalAtrasadas = todasTarefas.filter(
    (t) => avaliarSla(t).situacao === "atrasada"
  ).length;
  const campos = db.select().from(definicoesCampos).all();
  const totalEventos = db.select().from(auditLog).all().length;
  const integridade = verificarIntegridade();

  const indicadores = [
    { rotulo: "Tarefas registradas", valor: totalTarefas, href: "/kanban" },
    { rotulo: "Tarefas atrasadas", valor: totalAtrasadas, href: "/kanban", alerta: totalAtrasadas > 0 },
    { rotulo: "Campos dinâmicos ativos", valor: campos.filter((c) => c.ativa).length, href: "/campos" },
    { rotulo: "Eventos no inventário", valor: totalEventos, href: "/inventario" },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="kicker">Fase 2 · Kanban e SLA</p>
        <h2 className="mt-1 text-2xl font-bold">Painel do portfólio</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          Sobre a fundação da Fase 1, o quadro Kanban acompanha o portfólio nas 6 colunas
          de governança, com selos automáticos de SLA e edição rápida a partir do cartão.
          O motor de automações entra na próxima fase.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((i) => (
          <Link key={i.rotulo} href={i.href} className="cartao block transition hover:border-sky">
            <p className={`font-title text-4xl font-bold ${"alerta" in i && i.alerta ? "text-danger" : "text-brand"}`}>{i.valor}</p>
            <p className="mt-1 text-sm text-ink/70">{i.rotulo}</p>
          </Link>
        ))}
      </section>

      <section className="cartao flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Integridade da corrente de auditoria</p>
          <p className="text-xs text-ink/60">
            Verificação da corrente de hash do log: {integridade.totalLinhas} linhas analisadas.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
            integridade.integro ? "bg-ok" : "bg-danger"
          }`}
        >
          {integridade.integro ? "Íntegra" : "Corrente violada"}
        </span>
      </section>

      <section className="cartao">
        <p className="text-sm font-semibold">Prova do critério de fluidez</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink/80">
          <li>Crie um campo novo em <Link href="/campos" className="font-semibold text-brand">Campos</Link>, sem tocar em código.</li>
          <li>Use o campo imediatamente ao criar uma tarefa em <Link href="/tarefas" className="font-semibold text-brand">Tarefas</Link>.</li>
          <li>Mova e edite os cartões no <Link href="/kanban" className="font-semibold text-brand">Kanban</Link>: status, prazos, links e campos em até 2 cliques.</li>
          <li>Confira o lastro de tudo em <Link href="/inventario" className="font-semibold text-brand">Inventário</Link>.</li>
        </ol>
      </section>
    </div>
  );
}
