export type SituacaoSla =
  | "no_prazo"
  | "atencao"
  | "atrasada"
  | "repactuada"
  | "concluida"
  | "sem_prazo";

export type AvaliacaoSla = {
  situacao: SituacaoSla;
  diasRestantes: number | null;
  repactuada: boolean;
  entregueForaDoPrazo: boolean;
};

const DIA_MS = 86_400_000;

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

/**
 * Regras do selo de SLA do cartão:
 * concluída > atrasada > repactuada > atenção (3 dias ou menos) > no prazo.
 * Repactuação é detectada comparando prazo inicial (congelado) e prazo atual.
 */
export function avaliarSla(t: {
  status: string;
  prazoInicial?: string | Date | null;
  prazoAtual?: string | Date | null;
  concluidaEm?: string | Date | null;
}): AvaliacaoSla {
  const prazoInicial = paraData(t.prazoInicial);
  const prazoAtual = paraData(t.prazoAtual);
  const concluidaEm = paraData(t.concluidaEm);
  const repactuada =
    !!prazoInicial && !!prazoAtual && prazoInicial.getTime() !== prazoAtual.getTime();

  if (t.status === "concluido") {
    const entregueForaDoPrazo =
      !!prazoAtual && !!concluidaEm && concluidaEm.getTime() > prazoAtual.getTime();
    return { situacao: "concluida", diasRestantes: null, repactuada, entregueForaDoPrazo };
  }

  if (!prazoAtual) {
    return { situacao: "sem_prazo", diasRestantes: null, repactuada, entregueForaDoPrazo: false };
  }

  const dias = Math.ceil((prazoAtual.getTime() - Date.now()) / DIA_MS);
  if (dias < 0) {
    return { situacao: "atrasada", diasRestantes: dias, repactuada, entregueForaDoPrazo: false };
  }
  if (repactuada) {
    return { situacao: "repactuada", diasRestantes: dias, repactuada, entregueForaDoPrazo: false };
  }
  if (dias <= 3) {
    return { situacao: "atencao", diasRestantes: dias, repactuada, entregueForaDoPrazo: false };
  }
  return { situacao: "no_prazo", diasRestantes: dias, repactuada, entregueForaDoPrazo: false };
}

export function rotuloSla(a: AvaliacaoSla): string {
  switch (a.situacao) {
    case "concluida":
      return a.entregueForaDoPrazo ? "Concluída fora do prazo" : "Concluída";
    case "atrasada":
      return `Atrasada há ${Math.abs(a.diasRestantes ?? 0)} d${a.repactuada ? " · repactuada" : ""}`;
    case "repactuada":
      return `Repactuada · vence em ${a.diasRestantes} d`;
    case "atencao":
      return a.diasRestantes === 0 ? "Vence hoje" : `Vence em ${a.diasRestantes} d`;
    case "no_prazo":
      return `No prazo · ${a.diasRestantes} d`;
    default:
      return "Sem prazo";
  }
}

/** Classes Tailwind do selo, conforme a identidade visual CX. */
export function classeSla(a: AvaliacaoSla): string {
  switch (a.situacao) {
    case "concluida":
      return a.entregueForaDoPrazo ? "bg-ember text-white" : "bg-teal text-ink";
    case "atrasada":
      return "bg-danger text-white";
    case "repactuada":
      return "bg-ember text-white";
    case "atencao":
      return "bg-warn text-ink";
    case "no_prazo":
      return "bg-ok text-white";
    default:
      return "bg-mist text-ink";
  }
}
