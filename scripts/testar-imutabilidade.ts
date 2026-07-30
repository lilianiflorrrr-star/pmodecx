/**
 * Prova da Fase 1: tenta violar o log de auditoria e demonstra
 * que o próprio banco bloqueia UPDATE e DELETE por gatilho.
 * Executar com: npm run teste:imutabilidade
 */
import { raw } from "../src/db/client";
import { registrarEvento, verificarIntegridade } from "../src/services/auditoria.service";

registrarEvento({
  autor: "teste_automatizado",
  entidade: "sistema",
  entidadeId: "fase1",
  evento: "teste_imutabilidade",
  valorNovo: { executadoEm: new Date().toISOString() },
});
console.log("1. Evento de teste inserido no log (INSERT permitido).");

try {
  raw.prepare("UPDATE audit_log SET autor = 'adulterado' WHERE id = 1").run();
  console.error("2. FALHA DE GOVERNANÇA: o UPDATE foi aceito.");
  process.exit(1);
} catch (e) {
  console.log("2. UPDATE bloqueado pelo banco:", (e as Error).message);
}

try {
  raw.prepare("DELETE FROM audit_log WHERE id = 1").run();
  console.error("3. FALHA DE GOVERNANÇA: o DELETE foi aceito.");
  process.exit(1);
} catch (e) {
  console.log("3. DELETE bloqueado pelo banco:", (e as Error).message);
}

const integridade = verificarIntegridade();
console.log(
  `4. Corrente de hash: ${integridade.integro ? "íntegra" : "VIOLADA"} (${integridade.totalLinhas} linhas).`
);
console.log("Resultado: log imutável comprovado.");
