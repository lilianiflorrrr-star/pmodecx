import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const pastaDados = path.join(process.cwd(), "data");
if (!fs.existsSync(pastaDados)) fs.mkdirSync(pastaDados, { recursive: true });

const sqlite = new Database(path.join(pastaDados, "cx.db"));
// Durante o build, o Next.js carrega as rotas em processos paralelos que
// abrem o banco ao mesmo tempo. Sem espera, a disputa vira erro
// (SQLITE_BUSY) e o build quebra de forma intermitente.
sqlite.pragma("busy_timeout = 15000");

/**
 * A troca de journal_mode e o bootstrap do esquema não respeitam o
 * busy_timeout: sob disputa eles falham na hora. Aqui insistimos por alguns
 * segundos antes de desistir, para o build não quebrar por acaso.
 */
function comNovasTentativas<T>(operacao: () => T): T {
  const limite = Date.now() + 15_000;
  for (;;) {
    try {
      return operacao();
    } catch (erro) {
      const ehDisputa = (erro as { code?: string }).code === "SQLITE_BUSY";
      if (!ehDisputa || Date.now() >= limite) throw erro;
      // Espera curta e síncrona: o esquema precisa existir antes do export.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

comNovasTentativas(() => sqlite.pragma("journal_mode = WAL"));
sqlite.pragma("foreign_keys = ON");

// Bootstrap idempotente: cria a estrutura na primeira execução.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projetos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    perfil TEXT NOT NULL,
    sponsor TEXT,
    owner TEXT,
    descricao TEXT,
    campos_custom TEXT,
    criado_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS epicos (
    id TEXT PRIMARY KEY,
    projeto_id TEXT REFERENCES projetos(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    campos_custom TEXT,
    criado_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tarefas (
    id TEXT PRIMARY KEY,
    epico_id TEXT REFERENCES epicos(id),
    titulo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente_outras_etapas',
    responsavel TEXT,
    prazo_inicial INTEGER,
    prazo_atual INTEGER,
    concluida_em INTEGER,
    links_externos TEXT,
    campos_custom TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    criado_em INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
  CREATE INDEX IF NOT EXISTS idx_tarefas_epico ON tarefas(epico_id);

  CREATE TABLE IF NOT EXISTS documentos (
    id TEXT PRIMARY KEY,
    projeto_id TEXT REFERENCES projetos(id),
    epico_id TEXT REFERENCES epicos(id),
    titulo TEXT NOT NULL,
    conteudo TEXT,
    atualizado_em INTEGER
  );

  CREATE TABLE IF NOT EXISTS definicoes_campos (
    id TEXT PRIMARY KEY,
    chave TEXT NOT NULL UNIQUE,
    rotulo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    opcoes TEXT,
    aplica_a TEXT NOT NULL,
    exibir_no_cartao INTEGER DEFAULT 0,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ocorrido_em INTEGER NOT NULL,
    autor TEXT NOT NULL,
    entidade TEXT NOT NULL,
    entidade_id TEXT NOT NULL,
    evento TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    hash_corrente TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_log_entidade ON audit_log(entidade, entidade_id);
  CREATE INDEX IF NOT EXISTS idx_log_data ON audit_log(ocorrido_em);
  CREATE INDEX IF NOT EXISTS idx_log_evento ON audit_log(evento);

  CREATE TABLE IF NOT EXISTS automacoes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    ativa INTEGER NOT NULL DEFAULT 1,
    gatilho TEXT NOT NULL,
    condicoes TEXT,
    acoes TEXT,
    criado_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS execucoes_automacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automacao_id TEXT NOT NULL,
    chave_dedup TEXT NOT NULL,
    executado_em INTEGER NOT NULL,
    UNIQUE(automacao_id, chave_dedup)
  );

  -- Imutabilidade física do log: qualquer UPDATE ou DELETE é abortado
  -- pelo próprio banco, mesmo em acesso direto ao arquivo.
  CREATE TRIGGER IF NOT EXISTS bloqueia_update_log
  BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log é imutável: UPDATE bloqueado'); END;

  CREATE TRIGGER IF NOT EXISTS bloqueia_delete_log
  BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log é imutável: DELETE bloqueado'); END;
`);

// Migração leve: bancos criados antes deste campo existir ganham a coluna aqui.
// CREATE TABLE IF NOT EXISTS não altera tabelas já existentes, então isso cobre
// quem já tinha o arquivo data/cx.db de uma versão anterior.
try {
  sqlite.exec(`ALTER TABLE projetos ADD COLUMN descricao TEXT;`);
} catch {
  // coluna já existe: nada a fazer.
}

export const db = drizzle(sqlite, { schema });
export const raw = sqlite;
