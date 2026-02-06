import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all documents
export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").collect();
    return docs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get documents for a task
export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const docs = await ctx.db.query("documents").collect();
    return docs.filter((d) => d.taskId === args.taskId);
  },
});

// Get document by ID
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a document
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("other")
    ),
    taskId: v.optional(v.id("tasks")),
    createdById: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      type: args.type,
      taskId: args.taskId,
      createdById: args.createdById,
      createdAt: now,
    });

    // Create activity
    await ctx.db.insert("activities", {
      type: "document_created",
      agentId: args.createdById,
      taskId: args.taskId,
      message: `Document created: ${args.title}`,
      createdAt: now,
    });

    return docId;
  },
});

// Search documents
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db.query("documents").collect();
    const lowerQuery = args.query.toLowerCase();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(lowerQuery) ||
        d.content.toLowerCase().includes(lowerQuery)
    );
  },
});
