import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all agents
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

// Get agent by ID
export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get agent by session key
export const getBySessionKey = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.find((a) => a.sessionKey === args.sessionKey);
  },
});

// Create a new agent
export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    sessionKey: v.string(),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("agents", {
      ...args,
      currentTaskId: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update agent status
export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Update agent's current task
export const updateCurrentTask = mutation({
  args: {
    id: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      currentTaskId: args.taskId,
      updatedAt: Date.now(),
    });
  },
});

// Initialize all 6 agents
export const initializeAgents = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const agents = [
      { name: "Scout", role: "Researcher", sessionKey: "agent:researcher:main", status: "idle" as const },
      { name: "Scribe", role: "Writer", sessionKey: "agent:writer:main", status: "idle" as const },
      { name: "Surveyor", role: "Analyst", sessionKey: "agent:surveyor:main", status: "idle" as const },
      { name: "Forge", role: "Developer", sessionKey: "agent:forge:main", status: "idle" as const },
      { name: "Refiner", role: "Editor", sessionKey: "agent:refiner:main", status: "idle" as const },
      { name: "Marshal", role: "Executor", sessionKey: "agent:marshal:main", status: "idle" as const },
    ];

    for (const agent of agents) {
      await ctx.db.insert("agents", {
        ...agent,
        currentTaskId: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count: agents.length };
  },
});

// Get all idle agents
export const getIdleAgents = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.filter((a) => a.status === "idle");
  },
});
