import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get undelivered notifications for an agent
export const getUndelivered = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db.query("notifications").collect();
    return notifications
      .filter((n) => n.mentionedAgentId === args.agentId && !n.delivered)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Get all notifications for an agent
export const getAll = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db.query("notifications").collect();
    return notifications
      .filter((n) => n.mentionedAgentId === args.agentId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Create a notification
export const create = mutation({
  args: {
    mentionedAgentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      ...args,
      delivered: false,
      createdAt: Date.now(),
    });
  },
});

// Mark notification as delivered
export const markDelivered = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { delivered: true });
  },
});

// Mark all notifications as delivered for an agent
export const markAllDelivered = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db.query("notifications").collect();
    for (const n of notifications) {
      if (n.mentionedAgentId === args.agentId && !n.delivered) {
        await ctx.db.patch(n._id, { delivered: true });
      }
    }
  },
});

// Get undelivered count
export const getUndeliveredCount = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db.query("notifications").collect();
    return notifications.filter(
      (n) => n.mentionedAgentId === args.agentId && !n.delivered
    ).length;
  },
});
