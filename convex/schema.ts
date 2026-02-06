import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Agent registry - who are our agents
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    sessionKey: v.string(),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
    currentTaskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Tasks - the work to be done
  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
    assigneeIds: v.array(v.id("agents")),
    createdById: v.optional(v.id("agents")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Messages - comments on tasks
  messages: defineTable({
    taskId: v.id("tasks"),
    fromAgentId: v.optional(v.id("agents")),
    fromEmail: v.optional(v.string()),  // For email-sourced messages
    content: v.string(),
    attachments: v.array(v.id("documents")),
    createdAt: v.number(),
  }),

  // Activities - activity feed entries
  activities: defineTable({
    type: v.union(
      v.literal("task_created"),
      v.literal("task_assigned"),
      v.literal("task_started"),
      v.literal("task_completed"),
      v.literal("task_blocked"),
      v.literal("message_sent"),
      v.literal("document_created"),
      v.literal("email_received"),
      v.literal("email_sent"),
      v.literal("heartbeat_ok")
    ),
    agentId: v.optional(v.id("agents")),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
    createdAt: v.number(),
  }),

  // Documents - deliverables and files
  documents: defineTable({
    title: v.string(),
    content: v.string(),  // Markdown content
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("other")
    ),
    taskId: v.optional(v.id("tasks")),
    createdById: v.optional(v.id("agents")),
    createdAt: v.number(),
  }),

  // Notifications - @mentions and alerts
  notifications: defineTable({
    mentionedAgentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    content: v.string(),
    delivered: v.boolean(),
    createdAt: v.number(),
  }),

  // Email threads - for clawmail integration
  emailThreads: defineTable({
    threadId: v.string(),
    subject: v.string(),
    participants: v.array(v.string()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  }),
});
