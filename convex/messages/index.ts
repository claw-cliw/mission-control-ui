import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get messages for a task
export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const messages = await ctx.db.query("messages").collect();
    return messages
      .filter((m) => m.taskId === args.taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Create a message
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    fromAgentId: v.optional(v.id("agents")),
    fromEmail: v.optional(v.string()),
    content: v.string(),
    attachments: v.array(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      taskId: args.taskId,
      fromAgentId: args.fromAgentId,
      fromEmail: args.fromEmail,
      content: args.content,
      attachments: args.attachments,
      createdAt: now,
    });

    // Create activity
    await ctx.db.insert("activities", {
      type: "message_sent",
      agentId: args.fromAgentId,
      taskId: args.taskId,
      message: args.content.substring(0, 100),
      createdAt: now,
    });

    return messageId;
  },
});

// Get recent messages
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db.query("messages").collect();
    return messages
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit || 20);
  },
});
