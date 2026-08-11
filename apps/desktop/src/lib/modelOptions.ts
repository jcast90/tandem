import type { CodexModel, RoutingProfile } from "../types.js";

export interface ModelOption {
  value: string;
  label: string;
}

export function modelsForProfile(
  profile: RoutingProfile | undefined,
  codexModels: CodexModel[],
  selected: string | null
): ModelOption[] {
  const options = [
    { value: "", label: profile?.model ? `Profile default · ${profile.model}` : "CLI default" },
  ];
  if (profile?.transport === "codex-cli") {
    options.push(
      ...codexModels.map((model) => ({ value: model.model || model.id, label: model.displayName }))
    );
  } else if (profile?.transport === "claude-cli") {
    options.push(
      { value: "fable", label: "Fable (latest)" },
      { value: "opus", label: "Opus (latest)" },
      { value: "sonnet", label: "Sonnet (latest)" },
      { value: "claude-opus-4-8", label: "Opus 4.8" },
      { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { value: "claude-haiku-4-5", label: "Haiku 4.5" }
    );
  } else if (profile?.transport === "freebuff-cli") {
    options.push(
      { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
      { value: "minimax-m3", label: "MiniMax M3" },
      { value: "mimo-2.5", label: "MiMo 2.5" }
    );
  }
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: `Previously saved · ${selected}` });
  }
  return options;
}
