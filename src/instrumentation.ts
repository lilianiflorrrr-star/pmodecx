/**
 * Executado uma única vez na subida do servidor Next.
 * Liga o agendador de automações temporais.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarAgendador } = await import("@/automacao/agendador");
    iniciarAgendador();
  }
}
