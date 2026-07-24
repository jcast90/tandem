import type { ModelCapabilities, Profile, TaskRecord, WorkerReport } from "../protocol.js";

export interface WorkerRunResult {
  report: WorkerReport;
  sessionId: string | null;
  usage: Record<string, unknown> | null;
}

export interface WorkerAdapter {
  readonly transport: Profile["transport"];
  probe(profile: Profile): Promise<ModelCapabilities>;
  run(
    profile: Profile,
    task: TaskRecord,
    hooks: {
      onActivity: (type: string, payload?: Record<string, unknown>) => void;
    }
  ): Promise<WorkerRunResult>;
  cancel(): void;
}

export interface OuterAdapter {
  readonly transport: Profile["transport"];
  probe(profile: Profile): Promise<ModelCapabilities>;
  launch(profile: Profile, projectRoot: string, prompt?: string): Promise<number>;
}
