import type { ComposerAttachment, GoalHandoff, ProviderRoute, RoutingDecision } from "../types.js";

interface RoutingInput {
  text: string;
  recentMessages?: string[];
  attachments?: ComposerAttachment[];
}

const IMPLEMENTATION_PATTERNS = [
  /\bimplement(?:ation|ed|ing)?\b/g,
  /\bbuild(?:ing|s|t)?\b/g,
  /\bcode(?:d|s|ing)?\b/g,
  /\bfix(?:es|ed|ing)?\b/g,
  /\bdebug(?:ged|ging)?\b/g,
  /\brefactor(?:ed|ing)?\b/g,
  /\bmigrat(?:e|ed|es|ing|ion)\b/g,
  /\bintegrat(?:e|ed|es|ing|ion)\b/g,
  /\badd(?:ed|ing)?\b/g,
  /\bcreat(?:e|ed|es|ing)\b/g,
  /\bupdat(?:e|ed|es|ing)\b/g,
  /\bchang(?:e|ed|es|ing)\b/g,
  /\bmodif(?:y|ied|ies|ying)\b/g,
  /\bremov(?:e|ed|es|ing)\b/g,
  /\bship(?:ped|ping)?\b/g,
  /\bdeploy(?:ed|ing|ment)?\b/g,
  /\bscaffold(?:ed|ing)?\b/g,
  /\bwrite (?:the )?(?:code|tests?|implementation)\b/g,
  /\bmake (?:this|it|the .+?) work\b/g,
];

const DISCOVERY_PATTERNS = [
  /\bdiscuss(?:ion|ed|ing)?\b/g,
  /\bbrainstorm(?:ed|ing)?\b/g,
  /\bexplain(?:ed|ing)?\b/g,
  /\bresearch(?:ed|ing)?\b/g,
  /\banaly[sz](?:e|ed|es|ing|is)\b/g,
  /\bcompar(?:e|ed|es|ing|ison)\b/g,
  /\bplan(?:ned|ning)?\b/g,
  /\breview(?:ed|ing)?\b/g,
  /\baudit(?:ed|ing)?\b/g,
  /\brecommend(?:ed|ing|ation|ations)?\b/g,
  /\b(document|report|memo|brief|outline|summary|proposal|presentation)\b/g,
  /\bwhat (?:do|does|is|are|would|should|could)\b/g,
  /\bwhy\b/g,
  /\bhow (?:do|does|is|are|would|should|could)\b/g,
];

const CODE_CONTEXT =
  /\b(repo|repository|codebase|code|file|files|component|function|class|api|endpoint|database|schema|migration|test|tests|build|lint|typescript|javascript|rust|react|tauri|bug|feature|ui|cli)\b/g;
const VERIFICATION_CONTEXT =
  /\b(test|tests|testing|verify|verification|debug|build|lint|typecheck|ci|regression)\b/g;
const LARGE_SCOPE =
  /\b(multi[- ]file|end[- ]to[- ]end|long[- ]running|production|complete(?:ly)?|entire|across the|full implementation|do not stop|until (?:it is|it's) (?:done|complete)|finish the whole|\d+\s*(?:minutes?|hours?))\b/g;
const TINY_SCOPE =
  /\b(tiny|small|quick|one[- ]line|single line|typo|copy change|label|rename only|just rename)\b/g;
const AMBIGUOUS_FOLLOW_UP =
  /\b(?:can|could|would) (?:we|you) (?:do|build|make|implement|add|fix) (?:this|that|it)\b|\b(?:go ahead|do it|let's do it|sounds good|move forward|let's proceed|kick it off|start it)\b/i;

export function resolveRoute(route: ProviderRoute, input: RoutingInput): RoutingDecision {
  if (route === "claude") {
    return { mode: route, provider: "claude", reason: "You selected Claude" };
  }
  if (route === "codex") {
    return { mode: route, provider: "codex", reason: "You selected Codex" };
  }
  return classifyAutoRoute(input);
}

export function classifyAutoRoute(input: RoutingInput): RoutingDecision {
  const current = normalize(input.text);
  const wordCount = current.split(/\s+/).filter(Boolean).length;
  const ambiguous = wordCount <= 18 && AMBIGUOUS_FOLLOW_UP.test(current);
  const recent = (input.recentMessages ?? []).slice(-4).join(" ");
  const context = normalize(ambiguous ? `${current} ${recent}` : current);
  const implementationScore =
    countMatches(context, IMPLEMENTATION_PATTERNS) * 3 +
    countMatches(context, [CODE_CONTEXT]) +
    countMatches(context, [VERIFICATION_CONTEXT]) * 2 +
    countMatches(context, [LARGE_SCOPE]) * 2 +
    (input.attachments?.some((attachment) => attachment.kind === "folder") ? 2 : 0) +
    (input.attachments?.some((attachment) => attachment.kind === "file") ? 1 : 0);
  const discoveryScore = countMatches(context, DISCOVERY_PATTERNS) * 2;
  const tiny = wordCount <= 20 && hasMatch(current, TINY_SCOPE) && !hasMatch(context, LARGE_SCOPE);

  if (!tiny && (implementationScore >= 5 || implementationScore >= discoveryScore + 2)) {
    return {
      mode: "auto",
      provider: "claude",
      reason: routingReason(context),
    };
  }

  if (tiny && implementationScore > 0) {
    return { mode: "auto", provider: "codex", reason: "Small, bounded change" };
  }
  if (discoveryScore > 0) {
    return { mode: "auto", provider: "codex", reason: "Research, planning, or review" };
  }
  return {
    mode: "auto",
    provider: "codex",
    reason: "Conversation or lightweight work",
  };
}

export function routingPrompt(
  text: string,
  decision: RoutingDecision,
  claudeModel: string,
  workerPermission: string,
  goalHandoff?: GoalHandoff
): string {
  const instruction = routingInstruction(decision, claudeModel, workerPermission, goalHandoff);
  const goals = goalHandoff
    ? `\nouter_goal_id=${goalHandoff.outerGoalId}${
        goalHandoff.workerGoalId ? `\nworker_goal_id=${goalHandoff.workerGoalId}` : ""
      }`
    : "";
  return `${text}\n\n<tandem-routing>\nmode=${decision.mode}\nprovider=${decision.provider}\nreason=${decision.reason}${goals}\n${instruction}\n</tandem-routing>`;
}

export function routingDecisionFromText(text: string): RoutingDecision | null {
  const block = text.match(/<tandem-routing>([\s\S]*?)<\/tandem-routing>/)?.[1];
  if (!block) return null;
  const values = new Map(
    block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)] as const;
      })
  );
  const mode = values.get("mode");
  const provider = values.get("provider");
  const reason = values.get("reason");
  if (
    !reason ||
    (mode !== "auto" && mode !== "codex" && mode !== "claude") ||
    (provider !== "codex" && provider !== "claude")
  ) {
    return null;
  }
  return { mode, provider, reason };
}

export function conversationRoutingContext(
  messages: Array<{ role: string; text: string }>
): string[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => message.text)
    .filter(Boolean)
    .slice(-4);
}

export function goalDepthForRequest(
  decision: RoutingDecision,
  input: RoutingInput
): "none" | "outer" | "nested" {
  if (decision.provider === "claude") return "nested";
  const current = normalize(input.text);
  const wordCount = current.split(/\s+/).filter(Boolean).length;
  const ambiguous = wordCount <= 18 && AMBIGUOUS_FOLLOW_UP.test(current);
  const recent = (input.recentMessages ?? []).slice(-4).join(" ");
  const context = normalize(ambiguous ? `${current} ${recent}` : current);
  if (hasMatch(current, TINY_SCOPE)) return "none";
  const substantial =
    hasMatch(context, LARGE_SCOPE) ||
    countMatches(context, IMPLEMENTATION_PATTERNS) > 0 ||
    countMatches(context, DISCOVERY_PATTERNS) >= 2 ||
    /\b(goal|milestone|multi[- ]step|keep (?:working|pursuing)|follow through)\b/.test(context);
  return substantial ? "outer" : "none";
}

export function goalHandoffFromText(text: string): GoalHandoff | null {
  const block = text.match(/<tandem-routing>([\s\S]*?)<\/tandem-routing>/)?.[1];
  if (!block) return null;
  const outerGoalId = metadataValue(block, "outer_goal_id");
  if (!outerGoalId) return null;
  const workerGoalId = metadataValue(block, "worker_goal_id");
  return {
    outerGoalId,
    ...(workerGoalId ? { workerGoalId } : {}),
  };
}

export function conciseGoalObjective(text: string, prefix = ""): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const objective = clean.length > 180 ? `${clean.slice(0, 177).trimEnd()}…` : clean;
  return `${prefix}${objective}`;
}

function routingInstruction(
  decision: RoutingDecision,
  claudeModel: string,
  workerPermission: string,
  goalHandoff?: GoalHandoff
): string {
  if (decision.provider === "claude") {
    return `This routing decision is authoritative. Codex remains the outer planner and reviewer. The durable outer goal is ${goalHandoff?.outerGoalId ?? "not set"} and the Claude worker goal is ${goalHandoff?.workerGoalId ?? "not set"}. Do not edit files or run implementation commands yourself. Perform only the minimal read-only inspection needed to define a bounded work order, then call tandem_delegate with goal_id="${goalHandoff?.workerGoalId ?? ""}", wait for the worker, and review its result. Pass permission_mode="${workerPermission}"${
      claudeModel ? ` and model="${claudeModel}"` : ""
    } to tandem_delegate.`;
  }
  if (decision.mode === "codex") {
    return `Handle this request with Codex only. The durable outer goal is ${goalHandoff?.outerGoalId ?? "not set"}. Do not call tandem_delegate.`;
  }
  return `Handle this discussion, research, planning, review, or lightweight work with Codex. The durable outer goal is ${goalHandoff?.outerGoalId ?? "not set"}. If the request materially becomes substantive implementation or long-running execution, create a child goal under that outer goal and delegate the bounded portion through tandem_delegate instead of implementing it yourself.`;
}

function metadataValue(block: string, key: string): string | null {
  const line = block
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() || null : null;
}

function routingReason(text: string): string {
  if (hasMatch(text, LARGE_SCOPE)) return "Substantial or long-running implementation";
  if (hasMatch(text, VERIFICATION_CONTEXT)) return "Implementation and verification";
  return "Implementation work";
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    return total + [...text.matchAll(pattern)].length;
  }, 0);
}

function hasMatch(text: string, pattern: RegExp): boolean {
  return new RegExp(pattern.source, pattern.flags.replace("g", "")).test(text);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
