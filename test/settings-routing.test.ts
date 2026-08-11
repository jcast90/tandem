import { describe, expect, it } from "vitest";

import { modelsForProfile } from "../apps/desktop/src/lib/modelOptions.js";
import type { CodexModel, RoutingProfile } from "../apps/desktop/src/types.js";

const codexProfile: RoutingProfile = {
  id: "outer-primary",
  role: "outer",
  provider: "openai",
  transport: "codex-cli",
  model: null,
};

const claudeProfile: RoutingProfile = {
  id: "worker-primary",
  role: "worker",
  provider: "anthropic",
  transport: "claude-cli",
  model: null,
};

const codexModels: CodexModel[] = [
  {
    id: "gpt-5.6-codex",
    model: "gpt-5.6-codex",
    displayName: "GPT-5.6 Codex",
    description: "Coding model",
    isDefault: true,
    defaultReasoningEffort: "high",
    supportedReasoningEfforts: [],
  },
];

describe("routing model dropdowns", () => {
  it("uses the models discovered from Codex", () => {
    expect(modelsForProfile(codexProfile, codexModels, null)).toEqual([
      { value: "", label: "CLI default" },
      { value: "gpt-5.6-codex", label: "GPT-5.6 Codex" },
    ]);
  });

  it("offers current Claude CLI families and pinned models", () => {
    expect(modelsForProfile(claudeProfile, [], null)).toEqual([
      { value: "", label: "CLI default" },
      { value: "fable", label: "Fable (latest)" },
      { value: "opus", label: "Opus (latest)" },
      { value: "sonnet", label: "Sonnet (latest)" },
      { value: "claude-opus-4-8", label: "Opus 4.8" },
      { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { value: "claude-haiku-4-5", label: "Haiku 4.5" },
    ]);
  });

  it("keeps an existing custom value selectable after the field becomes closed", () => {
    expect(modelsForProfile(claudeProfile, [], "claude-opus-custom")).toContainEqual({
      value: "claude-opus-custom",
      label: "Previously saved · claude-opus-custom",
    });
  });
});
