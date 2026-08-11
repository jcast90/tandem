import type {
  ComposerAttachment,
  GoalHandoff,
  ProviderRoute,
  RoutingDecision,
  RoutingProfile,
  RoutingRule,
  RoutingTaskClass,
} from "../types.js";

interface RoutingInput {
  text: string;
  recentMessages?: string[];
  attachments?: ComposerAttachment[];
}

export interface RoutingPolicy {
  profiles: RoutingProfile[];
  rules: RoutingRule[];
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
const ARCHITECTURE_CONTEXT =
  /\b(architect(?:ure|ing)?|systems? design|technical design|data model|domain model|design the system|design an? api|trade[- ]offs?|rfc)\b/g;
const LARGE_SCOPE =
  /\b(multi[- ]file|end[- ]to[- ]end|long[- ]running|production|complete(?:ly)?|entire|across the|full implementation|do not stop|until (?:it is|it's) (?:done|complete)|finish the whole|\d+\s*(?:minutes?|hours?))\b/g;
const TINY_SCOPE =
  /\b(tiny|small|quick|one[- ]line|single line|typo|copy change|label|rename only|just rename)\b/g;
const AMBIGUOUS_FOLLOW_UP =
  /\b(?:can|could|would) (?:we|you) (?:do|build|make|implement|add|fix) (?:this|that|it)\b|\b(?:go ahead|do it|let's do it|sounds good|move forward|let's proceed|kick it off|start it)\b/i;

export function resolveRoute(
  route: ProviderRoute,
  input: RoutingInput,
  policy?: RoutingPolicy
): RoutingDecision {
  const taskClass = classifyTaskClass(input);
  if (route === "claude") {
    return decisionFromPolicy(route, "claude", taskClass, "You selected Claude", policy);
  }
  if (route === "codex") {
    return decisionFromPolicy(route, "codex", taskClass, "You selected Codex", policy);
  }
  return classifyAutoRoute(input, policy);
}

export function classifyAutoRoute(input: RoutingInput, policy?: RoutingPolicy): RoutingDecision {
  const taskClass = classifyTaskClass(input);
  const reason = taskClassReason(taskClass);
  if (policy) {
    const rule = policy.rules.find((candidate) => candidate.taskClass === taskClass);
    const profile = rule
      ? policy.profiles.find((candidate) => candidate.id === rule.profileId)
      : undefined;
    if (rule && profile) {
      return {
        mode: "auto",
        provider: providerForProfile(profile),
        reason,
        taskClass,
        profileId: rule.profileId,
        model: rule.model ?? profile.model,
        effort: rule.effort,
        maxConcurrency: rule.maxConcurrency,
      };
    }
  }
  const provider = taskClass === "implementation" ? "claude" : "codex";
  return { mode: "auto", provider, reason, taskClass };
}

export function classifyTaskClass(input: RoutingInput): RoutingTaskClass {
  const current = normalize(input.text);
  const wordCount = current.split(/\s+/).filter(Boolean).length;
  const ambiguous = wordCount <= 18 && AMBIGUOUS_FOLLOW_UP.test(current);
  const recent = (input.recentMessages ?? []).slice(-4).join(" ");
  const context = normalize(ambiguous ? `${current} ${recent}` : current);
  const implementationMatches = countMatches(context, IMPLEMENTATION_PATTERNS);
  const implementationScore =
    implementationMatches * 3 +
    countMatches(context, [CODE_CONTEXT]) +
    countMatches(context, [VERIFICATION_CONTEXT]) * 2 +
    countMatches(context, [LARGE_SCOPE]) * 2 +
    (input.attachments?.some((attachment) => attachment.kind === "folder") ? 2 : 0) +
    (input.attachments?.some((attachment) => attachment.kind === "file") ? 1 : 0);
  const discoveryScore = countMatches(context, DISCOVERY_PATTERNS) * 2;
  const tiny = wordCount <= 20 && hasMatch(current, TINY_SCOPE) && !hasMatch(context, LARGE_SCOPE);

  if (tiny && implementationScore > 0) return "quick";
  if (hasMatch(context, ARCHITECTURE_CONTEXT)) return "architecture";
  if (hasMatch(context, VERIFICATION_CONTEXT) && implementationMatches === 0) {
    return "verification";
  }
  if (!tiny && (implementationScore >= 5 || implementationScore >= discoveryScore + 2)) {
    return "implementation";
  }
  if (hasMatch(context, VERIFICATION_CONTEXT)) return "verification";
  if (discoveryScore > 0) return "research";
  return "conversation";
}

function decisionFromPolicy(
  mode: Exclude<ProviderRoute, "auto">,
  provider: "codex" | "claude",
  taskClass: RoutingTaskClass,
  reason: string,
  policy?: RoutingPolicy
): RoutingDecision {
  const profile = policy?.profiles.find((candidate) => providerForProfile(candidate) === provider);
  const configured = policy?.rules.find(
    (candidate) =>
      candidate.taskClass === taskClass &&
      policy.profiles.some(
        (profileOption) =>
          profileOption.id === candidate.profileId && providerForProfile(profileOption) === provider
      )
  );
  if (configured) {
    const configuredProfile = policy?.profiles.find(
      (candidate) => candidate.id === configured.profileId
    );
    return {
      mode,
      provider,
      reason,
      taskClass,
      profileId: configured.profileId,
      model: configured.model ?? configuredProfile?.model ?? null,
      effort: configured.effort,
      maxConcurrency: configured.maxConcurrency,
    };
  }
  return {
    mode,
    provider,
    reason,
    taskClass,
    ...(profile ? { profileId: profile.id } : {}),
    model: profile?.model ?? null,
  };
}

export function routingPrompt(
  text: string,
  decision: RoutingDecision,
  modelOverride: string,
  workerPermission: string,
  goalHandoff?: GoalHandoff,
  policy?: RoutingPolicy
): string {
  const effectiveModel = modelOverride || decision.model || "";
  const instruction = routingInstruction(
    decision,
    effectiveModel,
    workerPermission,
    goalHandoff,
    policy
  );
  const goals = goalHandoff
    ? `\nouter_goal_id=${goalHandoff.outerGoalId}${
        goalHandoff.workerGoalId ? `\nworker_goal_id=${goalHandoff.workerGoalId}` : ""
      }`
    : "";
  const details = [
    decision.taskClass ? `task_class=${decision.taskClass}` : "",
    decision.profileId ? `profile_id=${decision.profileId}` : "",
    effectiveModel ? `model=${effectiveModel}` : "",
    decision.effort ? `effort=${decision.effort}` : "",
    decision.maxConcurrency ? `max_concurrency=${decision.maxConcurrency}` : "",
  ]
    .filter(Boolean)
    .map((value) => `\n${value}`)
    .join("");
  return `${text}\n\n<tandem-routing>\nmode=${decision.mode}\nprovider=${decision.provider}\nreason=${decision.reason}${details}${goals}\n${instruction}\n</tandem-routing>`;
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
  const taskClass = values.get("task_class");
  const profileId = values.get("profile_id");
  const maxConcurrency = Number.parseInt(values.get("max_concurrency") ?? "", 10);
  if (
    !reason ||
    (mode !== "auto" && mode !== "codex" && mode !== "claude") ||
    (provider !== "codex" && provider !== "claude")
  ) {
    return null;
  }
  return {
    mode,
    provider,
    reason,
    ...(isTaskClass(taskClass) ? { taskClass } : {}),
    ...(profileId ? { profileId } : {}),
    ...(values.has("model") ? { model: values.get("model") || null } : {}),
    ...(values.has("effort") ? { effort: values.get("effort") || null } : {}),
    ...(Number.isFinite(maxConcurrency) ? { maxConcurrency } : {}),
  };
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
  effectiveModel: string,
  workerPermission: string,
  goalHandoff?: GoalHandoff,
  policy?: RoutingPolicy
): string {
  const taskPolicy = policySummary(policy);
  if (decision.provider === "claude") {
    return `This routing decision is authoritative. Codex remains the outer planner and reviewer. The durable outer goal is ${goalHandoff?.outerGoalId ?? "not set"} and the worker goal is ${goalHandoff?.workerGoalId ?? "not set"}. First assess whether independent read-only scoping or review work can benefit from up to ${decision.maxConcurrency ?? 3} Codex collaboration subagents; use them only when the expected speed or quality gain exceeds coordination and token cost. Do not edit files or run implementation commands yourself. Perform only the minimal read-only inspection needed to define a bounded work order, then call tandem_delegate with goal_id="${goalHandoff?.workerGoalId ?? ""}"${decision.taskClass ? ` and task_class="${decision.taskClass}"` : ""}${decision.profileId ? ` and profile_id="${decision.profileId}"` : ""}, wait for the worker, and review its result. Pass permission_mode="${workerPermission}"${
      effectiveModel ? ` and model="${effectiveModel}"` : ""
    }${decision.effort ? ` and effort="${decision.effort}"` : ""} to tandem_delegate.${taskPolicy}`;
  }
  if (decision.mode === "codex") {
    return `Handle this request with Codex only. The durable outer goal is ${goalHandoff?.outerGoalId ?? "not set"}. For substantial work, always assess whether two or more independent research, inspection, or review packets can run through Codex collaboration subagents. Use at most ${decision.maxConcurrency ?? 3} when the expected speed or quality gain exceeds coordination and token cost; otherwise stay serial. Do not call tandem_delegate.${taskPolicy}`;
  }
  return `Handle this discussion, research, planning, review, or lightweight work with Codex. The durable outer goal is ${goalHandoff?.outerGoalId ?? "not set"}. For substantial work, always assess whether two or more independent research, inspection, or review packets can run through Codex collaboration subagents. Use at most ${decision.maxConcurrency ?? 3} when the expected speed or quality gain exceeds coordination and token cost; otherwise stay serial. If the request materially becomes substantive implementation or long-running execution, create a child goal under that outer goal and delegate the bounded portion through tandem_delegate instead of implementing it yourself.${taskPolicy}`;
}

function metadataValue(block: string, key: string): string | null {
  const line = block
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() || null : null;
}

function taskClassReason(taskClass: RoutingTaskClass): string {
  const reasons: Record<RoutingTaskClass, string> = {
    conversation: "Conversation or lightweight work",
    quick: "Small, bounded change",
    research: "Research, planning, or review",
    architecture: "Architecture or systems design",
    implementation: "Substantive implementation work",
    verification: "Verification, audit, or integration review",
  };
  return reasons[taskClass];
}

function providerForProfile(profile: RoutingProfile): "codex" | "claude" {
  if (profile.transport === "claude-cli") return "claude";
  if (profile.transport === "codex-cli") return "codex";
  return profile.provider.toLowerCase().includes("anthropic") ? "claude" : "codex";
}

function policySummary(policy?: RoutingPolicy): string {
  if (!policy || policy.rules.length === 0) return "";
  const summary = policy.rules
    .map((rule) => {
      const profile = policy.profiles.find((candidate) => candidate.id === rule.profileId);
      return `${rule.taskClass}=>${rule.profileId}/${rule.model ?? profile?.model ?? "default"}/${rule.effort ?? "auto"}`;
    })
    .join(", ");
  return ` When creating child tasks or an execution plan, apply this task policy unless the user made a turn-level override: ${summary}.`;
}

function isTaskClass(value: string | undefined): value is RoutingTaskClass {
  return [
    "conversation",
    "quick",
    "research",
    "architecture",
    "implementation",
    "verification",
  ].includes(value ?? "");
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
