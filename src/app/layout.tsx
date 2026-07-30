import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "lililili",
  description: "Plataforma de gestão e automação de projetos do PMO CX",
};

const NAVEGACAO = [
  { href: "/", rotulo: "Painel" },
  { href: "/projetos", rotulo: "Projetos" },
  { href: "/kanban", rotulo: "Kanban" },
  { href: "/campos", rotulo: "Campos" },
  { href: "/tarefas", rotulo: "Tarefas" },
  { href: "/automacoes", rotulo: "Automações" },
  { href: "/inventario", rotulo: "Inventário" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="border-b border-mist bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <p className="kicker">PMO CX · Asaas</p>
              <h1 className="text-lg font-bold text-ink">lililili</h1>
            </div>
            <nav className="flex gap-1">
              {NAVEGACAO.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink transition hover:bg-paper hover:text-brand"
                >
                  {item.rotulo}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-8 text-xs text-ink/50">
          Fase 4: porta de entrada externa e exportação do inventário. Toda movimentação, humana ou automática, gera lastro. Toda movimentação gera lastro no inventário.
        </footer>
      </body>
    </html>
  );
}
