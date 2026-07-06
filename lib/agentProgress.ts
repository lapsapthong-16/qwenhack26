export const LIVE_ROLES = ["Baseline", "Manifest", "Static", "Behavior", "Skeptic", "Judge"] as const;
export type LiveRole = (typeof LIVE_ROLES)[number];
export type LiveRoleStatus = "queued" | "running" | "done" | "failed";

export const LIVE_PHASES = [
  { name: "Baseline", roles: ["Baseline"] },
  { name: "Parallel inspection", roles: ["Manifest", "Static", "Behavior"] },
  { name: "Resolution", roles: ["Skeptic", "Judge"] },
] as const satisfies readonly { name:string; roles:readonly LiveRole[] }[];

export function roleState(role: LiveRole, job?: {
  currentRole?: string;
  currentRoles?: string[];
  completedRoles?: string[];
  roleStatus?: Record<string, LiveRoleStatus>;
}) {
  return job?.roleStatus?.[role]
    || (job?.currentRoles?.includes(role) || job?.currentRole === role ? "running" : job?.completedRoles?.includes(role) ? "done" : "queued");
}

export function phaseState(roles: readonly LiveRole[], job?: Parameters<typeof roleState>[1]) {
  const states = roles.map(role => roleState(role, job));
  if (states.includes("running")) return "running";
  if (states.includes("failed")) return "failed";
  if (states.every(state => state === "done")) return "done";
  return "queued";
}
