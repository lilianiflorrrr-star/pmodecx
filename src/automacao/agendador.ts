import cron from "node-cron";
import { verificarGatilhosTemporais } from "./motor";
import { sincronizacaoAtiva, sincronizarPlanilha } from "@/services/sheets.service";

/**
 * Agendador limitado ao horário de expediente (padrão: 8h às 19h, seg a sex),
 * pois a aplicação roda na máquina do PMO. Ao subir o servidor, uma varredura
 * de recuperação roda na hora: ligar a máquina de manhã já dispara os alertas
 * do dia, sem depender do relógio do cron.
 */
function dentroDoExpediente(agora = new Date()) {
  const inicio = Number(process.env.EXPEDIENTE_INICIO ?? 8);
  const fim = Number(process.env.EXPEDIENTE_FIM ?? 19);
  const dia = agora.getDay(); // 0 domingo ... 6 sábado
  const hora = agora.getHours();
  return dia >= 1 && dia <= 5 && hora >= inicio && hora < fim;
}

export function iniciarAgendador() {
  const global = globalThis as { __agendadorCX?: boolean };
  if (global.__agendadorCX) return;
  global.__agendadorCX = true;

  // Varredura de recuperação ao subir o servidor.
  setTimeout(() => {
    verificarGatilhosTemporais()
      .then((r) => console.log(`[automação] varredura inicial: ${r.disparos} disparo(s).`))
      .catch((e) => console.error("[automação] varredura inicial falhou:", e));
  }, 3000);

  // Verificação recorrente a cada 30 minutos dentro do expediente.
  cron.schedule("*/30 * * * *", async () => {
    if (!dentroDoExpediente()) return;
    try {
      const r = await verificarGatilhosTemporais();
      if (r.disparos > 0) console.log(`[automação] varredura: ${r.disparos} disparo(s).`);
    } catch (e) {
      console.error("[automação] varredura falhou:", e);
    }
  });

  // Espelho no Google Sheets: a cada 10 minutos dentro do expediente.
  // A sincronização só chama o Google quando o conteúdo mudou, então rodar
  // com frequência não consome cota à toa.
  if (sincronizacaoAtiva()) {
    cron.schedule("*/10 * * * *", async () => {
      if (!dentroDoExpediente()) return;
      try {
        const r = await sincronizarPlanilha("agendador:sheets");
        if (r.sincronizado) {
          console.log(`[sheets] espelho atualizado: ${r.tarefas} tarefa(s), ${r.eventos} evento(s).`);
        }
      } catch (e) {
        console.error("[sheets] sincronização falhou:", e);
      }
    });
    console.log("[sheets] espelho no Google Sheets ativo (a cada 10 min no expediente).");
  }

  console.log("[automação] agendador iniciado (expediente: seg a sex).");
}
