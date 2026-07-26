import type { Activity, ChatMessage, GoalHandoff, RoutingDecision } from "../types.js";

export interface WorkMetadata {
  routing?: RoutingDecision;
  goalHandoff?: GoalHandoff;
}

export function startWorkSegment(
  messages: ChatMessage[],
  turnId: string,
  startedAt: number,
  metadata: WorkMetadata = {}
): ChatMessage[] {
  const existing = messages.findIndex(
    (message) => message.role === "work" && message.turnId === turnId
  );
  if (existing >= 0) {
    return messages.map((message, index) =>
      index === existing
        ? {
            ...message,
            ...missingMetadata(message, metadata),
          }
        : message
    );
  }

  const pending = messages.findLastIndex(
    (message) =>
      message.role === "work" &&
      message.workStatus === "running" &&
      message.turnId?.startsWith("pending-")
  );
  if (pending >= 0) {
    return messages.map((message, index) =>
      index === pending
        ? {
            ...message,
            id: `work-${turnId}-initial`,
            turnId,
            startedAt: message.startedAt ?? startedAt,
            ...missingMetadata(message, metadata),
          }
        : message
    );
  }

  return [...messages, workMessage(`work-${turnId}-initial`, turnId, startedAt, metadata, [])];
}

export function attachActivityToTimeline(
  messages: ChatMessage[],
  activity: Activity,
  metadata: WorkMetadata = {}
): ChatMessage[] {
  const turnId = activity.turnId;
  if (!turnId) return messages;
  if (
    messages.some(
      (message) => message.role === "work" && message.activityIds?.includes(activity.id)
    )
  ) {
    return messages;
  }

  const last = messages.at(-1);
  if (last?.role === "work" && last.turnId === turnId && last.workStatus === "running") {
    return messages.map((message, index) =>
      index === messages.length - 1
        ? {
            ...message,
            activityIds: [...(message.activityIds ?? []), activity.id],
            ...missingMetadata(message, metadataForFirstSegment(messages, turnId, metadata)),
          }
        : message
    );
  }

  const segmentMetadata = metadataForFirstSegment(messages, turnId, metadata);
  return [
    ...messages,
    workMessage(
      `work-${turnId}-${activity.id}`,
      turnId,
      activity.startedAt ?? activity.completedAt ?? Date.now(),
      segmentMetadata,
      [activity.id]
    ),
  ];
}

export function closeOpenWorkSegment(
  messages: ChatMessage[],
  turnId: string,
  completedAt: number
): ChatMessage[] {
  const index = messages.findLastIndex(
    (message) =>
      message.role === "work" && message.turnId === turnId && message.workStatus === "running"
  );
  if (index < 0) return messages;
  const segment = messages[index];
  if (!segment) return messages;
  if ((segment.activityIds?.length ?? 0) === 0 && !segment.goalHandoff) {
    return messages.filter((_, messageIndex) => messageIndex !== index);
  }
  return messages.map((message, messageIndex) =>
    messageIndex === index ? completedWorkMessage(message, "completed", completedAt) : message
  );
}

export function completeWorkSegments(
  messages: ChatMessage[],
  turnId: string,
  status: NonNullable<ChatMessage["workStatus"]>,
  completedAt: number
): ChatMessage[] {
  return messages
    .filter(
      (message) =>
        !(
          message.role === "work" &&
          message.turnId === turnId &&
          (message.activityIds?.length ?? 0) === 0 &&
          !message.goalHandoff
        )
    )
    .map((message) =>
      message.role === "work" && message.turnId === turnId && message.workStatus === "running"
        ? completedWorkMessage(message, status, completedAt)
        : message
    );
}

export function activitiesForMessage(message: ChatMessage, turnActivities: Activity[]): Activity[] {
  if (!message.activityIds) return turnActivities;
  const ids = new Set(message.activityIds);
  return turnActivities.filter((activity) => ids.has(activity.id));
}

function workMessage(
  id: string,
  turnId: string,
  startedAt: number,
  metadata: WorkMetadata,
  activityIds: string[]
): ChatMessage {
  return {
    id,
    role: "work",
    text: "",
    turnId,
    workStatus: "running",
    startedAt,
    activityIds,
    ...(metadata.routing ? { routing: metadata.routing } : {}),
    ...(metadata.goalHandoff ? { goalHandoff: metadata.goalHandoff } : {}),
  };
}

function completedWorkMessage(
  message: ChatMessage,
  status: NonNullable<ChatMessage["workStatus"]>,
  completedAt: number
): ChatMessage {
  return {
    ...message,
    workStatus: status,
    completedAt,
    durationMs: Math.max(0, completedAt - (message.startedAt ?? completedAt)),
  };
}

function metadataForFirstSegment(
  messages: ChatMessage[],
  turnId: string,
  metadata: WorkMetadata
): WorkMetadata {
  return messages.some((message) => message.role === "work" && message.turnId === turnId)
    ? {}
    : metadata;
}

function missingMetadata(message: ChatMessage, metadata: WorkMetadata): WorkMetadata {
  return {
    ...(!message.routing && metadata.routing ? { routing: metadata.routing } : {}),
    ...(!message.goalHandoff && metadata.goalHandoff ? { goalHandoff: metadata.goalHandoff } : {}),
  };
}
