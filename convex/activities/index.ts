import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get recent activities
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const activities = await ctx.db.query("activities").collect();
    return activities
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit || 50);
  },
});

// Get activities for a task
export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const activities = await ctx.db.query("activities").collect();
    return activities
      .filter((a) => a.taskId === args.taskId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get activities for an agent
export const getByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const activities = await ctx.db.query("activities").collect();
    return activities
      .filter((a) => a.agentId === args.agentId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  },
});

// Create an activity
export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Log heartbeat
export const logHeartbeat = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await ctx.db.insert("activities", {
      type: "heartbeat_ok",
      agentId: args.agentId,
      message: "Heartbeat check - no action needed",
      createdAt: Date.now(),
    });
  },
});
