export type OrchestrationStatusEvent =
  | {
      type: "status";
      phase:
        | "plan_start"
        | "plan_end"
        | "run_start"
        | "run_end"
        | "repair_start"
        | "repair_end";
      steps?: string[];
    }
  | { type: "status"; phase: "cancelled" }
  | { type: "status"; phase: "error"; message: string };

export type OrchestrationDeltaEvent = { type: "delta"; content: string };

export type OrchestrationFinalEvent = {
  type: "final";
  message: { role: "assistant"; content: string };
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type OrchestrationStepEvent = {
  type: "step";
  index: number;
  total: number;
  title: string;
  status: "start" | "end";
};

export type OrchestrationContextEvent = {
  type: "context";
  messages: number;
};

export type OrchestrationToolEvent =
  | {
      type: "tool";
      phase: "start";
      toolName: string;
      payload: unknown;
    }
  | {
      type: "tool";
      phase: "result";
      toolName: string;
      result: unknown;
    }
  | {
      type: "tool";
      phase: "error";
      toolName: string;
      error: string;
    };

export type OrchestrationEvent =
  | OrchestrationStatusEvent
  | OrchestrationDeltaEvent
  | OrchestrationFinalEvent
  | OrchestrationStepEvent
  | OrchestrationContextEvent
  | OrchestrationToolEvent;

export type EmitOrchestrationEvent = (evt: OrchestrationEvent) => void;
