import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all tasks
export const list = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get tasks by status
export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.filter((t) => t.status === args.status);
  },
});

// Get tasks assigned to an agent
export const getByAssignee = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.filter((t) => t.assigneeIds.includes(args.agentId));
  },
});

// Get task by ID
export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new task
export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status,
      assigneeIds: args.assigneeIds,
      createdById: args.createdById,
      createdAt: now,
      updatedAt: now,
    });

    // Create activity
    await ctx.db.insert("activities", {
      type: "task_created",
      agentId: args.createdById,
      taskId,
      message: `Task created: ${args.title}`,
      createdAt: now,
    });

    // Notify assignees
    for (const agentId of args.assigneeIds) {
      await ctx.db.insert("notifications", {
        mentionedAgentId: agentId,
        taskId,
        content: `You've been assigned a new task: ${args.title}`,
        delivered: false,
        createdAt: now,
      });
    }

    return taskId;
  },
});

// Update task status
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    // Create activity
    await ctx.db.insert("activities", {
      type: `task_${args.status}`,
      taskId: args.id,
      message: `Task status changed to ${args.status}: ${task.title}`,
      createdAt: Date.now(),
    });
  },
});

// Assign task to agent
export const assign = mutation({
  args: {
    id: v.id("tasks"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    if (!task.assigneeIds.includes(args.agentId)) {
      await ctx.db.patch(args.id, {
        assigneeIds: [...task.assigneeIds, args.agentId],
        status: task.status === "inbox" ? "assigned" : task.status,
        updatedAt: Date.now(),
      });

      // Notify the new assignee
      await ctx.db.insert("notifications", {
        mentionedAgentId: args.agentId,
        taskId: args.id,
        content: `You've been assigned: ${task.title}`,
        delivered: false,
        createdAt: Date.now(),
      });

      // Create activity
      await ctx.db.insert("activities", {
        type: "task_assigned",
        taskId: args.id,
        message: `Task assigned to agent`,
        createdAt: Date.now(),
      });
    }
  },
});

// Get inbox tasks (unassigned)
export const getInbox = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.filter((t) => t.status === "inbox");
  },
});

// Claim a task (agent takes ownership)
export const claim = mutation({
  args: {
    id: v.id("tasks"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.id, {
      status: "in_progress",
      assigneeIds: [args.agentId],
      updatedAt: Date.now(),
    });

    // Create activity
    await ctx.db.insert("activities", {
      type: "task_started",
      agentId: args.agentId,
      taskId: args.id,
      message: `Task started: ${task.title}`,
      createdAt: Date.now(),
    });
  },
});

// Get task counts by status
export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const counts = {
      inbox: 0,
      assigned: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    };

    for (const task of tasks) {
      counts[task.status as keyof typeof counts]++;
    }

    return counts;
  },
});
