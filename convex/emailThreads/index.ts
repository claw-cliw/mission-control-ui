import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all email threads
export const list = query({
  args: {},
  handler: async (ctx) => {
    const threads = await ctx.db.query("emailThreads").collect();
    return threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

// Get or create thread
export const getOrCreate = mutation({
  args: { threadId: v.string(), subject: v.string(), participants: v.array(v.string()) },
  handler: async (ctx, args) => {
    const threads = await ctx.db.query("emailThreads").collect();
    const existing = threads.find((t) => t.threadId === args.threadId);

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("emailThreads", {
      threadId: args.threadId,
      subject: args.subject,
      participants: args.participants,
      lastMessageAt: now,
      createdAt: now,
    });
  },
});

// Update thread with new message
export const updateLastMessage = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const threads = await ctx.db.query("emailThreads").collect();
    const thread = threads.find((t) => t.threadId === args.threadId);

    if (thread) {
      await ctx.db.patch(thread._id, { lastMessageAt: Date.now() });
    }
  },
});
