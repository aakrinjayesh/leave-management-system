const LABELS = { ASSIGNED: "Client Project", NOT_ASSIGNED: "Internal Project" };

export const formatProjectAssigned = (value) => LABELS[value] || "—";
