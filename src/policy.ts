import {
  PermissionModeSchema,
  PonytailModeSchema,
  type PermissionMode,
  type PonytailMode,
  type TaskRecord,
} from "./protocol.js";

const REFERENCE_DIRECTORY_PREFIX = "Tandem reference directory: ";
const PONYTAIL_MODE_PREFIX = "Tandem Ponytail mode: ";

export function permissionMode(value: unknown, fallback: PermissionMode = "auto"): PermissionMode {
  if (value === "manual" || value === "default") return "ask";
  if (value === "acceptEdits" || value === "dontAsk") return "auto";
  if (value === "bypassPermissions") return "full";
  return PermissionModeSchema.safeParse(value).data ?? fallback;
}

export function sessionPermissionMode(fallback: PermissionMode = "auto"): PermissionMode {
  return permissionMode(process.env.TANDEM_PERMISSION_MODE, fallback);
}

export function claudePermissionMode(mode: unknown): "manual" | "auto" | "bypassPermissions" {
  const normalized = permissionMode(mode);
  if (normalized === "ask") return "manual";
  if (normalized === "full") return "bypassPermissions";
  return "auto";
}

export function nextPermissionMode(mode: PermissionMode): PermissionMode {
  const modes: PermissionMode[] = ["ask", "auto", "full"];
  return modes[(modes.indexOf(mode) + 1) % modes.length]!;
}

export function ponytailMode(value: unknown, fallback: PonytailMode = "full"): PonytailMode {
  return PonytailModeSchema.safeParse(value).data ?? fallback;
}

export function sessionPonytailMode(fallback: PonytailMode = "full"): PonytailMode {
  return ponytailMode(process.env.PONYTAIL_DEFAULT_MODE, fallback);
}

export function sessionReferenceDirectories(): string[] {
  const raw = process.env.TANDEM_ADDITIONAL_DIRS;
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return uniqueStrings(value);
  } catch {
    return [];
  }
}

export function policyContext(
  context: string[],
  options: { ponytailMode: PonytailMode; referenceDirectories: string[] }
): string[] {
  return [
    ...context.filter(
      (item) =>
        !item.startsWith(PONYTAIL_MODE_PREFIX) && !item.startsWith(REFERENCE_DIRECTORY_PREFIX)
    ),
    `${PONYTAIL_MODE_PREFIX}${options.ponytailMode}`,
    ...uniqueStrings(options.referenceDirectories).map(
      (directory) => `${REFERENCE_DIRECTORY_PREFIX}${directory}`
    ),
  ];
}

export function taskPonytailMode(task: TaskRecord): PonytailMode {
  const entry = task.context.find((item) => item.startsWith(PONYTAIL_MODE_PREFIX));
  return ponytailMode(entry?.slice(PONYTAIL_MODE_PREFIX.length), sessionPonytailMode());
}

export function taskReferenceDirectories(task: TaskRecord): string[] {
  return uniqueStrings(
    task.context
      .filter((item) => item.startsWith(REFERENCE_DIRECTORY_PREFIX))
      .map((item) => item.slice(REFERENCE_DIRECTORY_PREFIX.length))
  );
}

export function ponytailWorkerInstruction(mode: PonytailMode): string {
  if (mode === "off") return "Ponytail is off for this task.";
  const intensity =
    mode === "lite"
      ? "Build what was requested and briefly identify a simpler alternative when one exists."
      : mode === "ultra"
        ? "Apply strict YAGNI: prefer deletion and native one-line solutions, while still honoring explicit requirements."
        : "Enforce the minimum-correct-solution ladder.";
  return `Ponytail ${mode} is active. ${intensity} After understanding the real flow, prefer: no new code, reuse existing code, standard library, native platform capability, an installed dependency, then the smallest correct implementation. Never simplify away trust-boundary validation, data-loss protection, security, accessibility, or an explicit requirement.`;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
}
