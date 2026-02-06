import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'shared', 'mission-data');
const DB_PATH = join(DATA_DIR, 'database.json');
const API_TOKEN = process.env.API_TOKEN || 'mc-dev-token-2024';

// Auth helper
function checkAuth(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const token = url.searchParams.get('token') || req.headers['x-api-token'];
  if (token !== API_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

// File helpers
function getTaskFilePath(taskId) {
  const db = readDB();
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return null;
  
  // Check outputPath first, then analysisPath
  if (task.outputPath && fs.existsSync(join(__dirname, task.outputPath))) {
    return join(__dirname, task.outputPath);
  }
  if (task.analysisPath && fs.existsSync(join(__dirname, task.analysisPath))) {
    return join(__dirname, task.analysisPath);
  }
  
  // Fallback: search in output folder
  const outputPath = join(__dirname, 'shared', 'tasks', 'output', `${taskId}.md`);
  if (fs.existsSync(outputPath)) return outputPath;
  
  const finalPath = join(__dirname, 'shared', 'tasks', 'output', `${taskId}-final.md`);
  if (fs.existsSync(finalPath)) return finalPath;
  
  return null;
}

function getTaskFileContent(taskId) {
  const filePath = getTaskFilePath(taskId);
  if (!filePath) return null;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = filePath.split('/').pop();
  const isMarkdown = filename.endsWith('.md');
  
  return { content, filename, isMarkdown, path: filePath };
}

// Delete task files from disk
function deleteTaskFiles(taskId) {
  const outputDir = join(__dirname, 'shared', 'tasks', 'output');
  const analysisDir = join(__dirname, 'shared', 'tasks', 'analysis');
  
  const patterns = [
    join(outputDir, `${taskId}.md`),
    join(outputDir, `${taskId}-*.md`),
    join(analysisDir, `${taskId}.md`),
  ];
  
  let deleted = 0;
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Glob pattern - find matching files
      const dir = pattern.substring(0, pattern.lastIndexOf('/'));
      const prefix = pattern.substring(pattern.lastIndexOf('/') + 1).replace('*', '');
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith(prefix.replace('.md', '')) && file.endsWith('.md')) {
            fs.unlinkSync(join(dir, file));
            deleted++;
          }
        }
      } catch (e) {}
    } else if (fs.existsSync(pattern)) {
      fs.unlinkSync(pattern);
      deleted++;
    }
  }
  return deleted;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database file
const initDB = () => {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      agents: [],
      tasks: [],
      messages: [],
      activities: [],
      documents: [],
      notifications: [],
      emailThreads: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
};

initDB();

const readDB = () => JSON.parse(fs.readFileSync(DB_PATH));
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
const now = () => Date.now();

// SSE clients
const sseClients = new Set();

const broadcast = (eventType, data) => {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
};

// Helper functions
function getAgents() { return readDB().agents; }
function createAgent(body) {
  const db = readDB();
  const agent = { id: Date.now().toString(), ...body, status: 'idle', currentTaskId: null, createdAt: now(), updatedAt: now() };
  db.agents.push(agent);
  writeDB(db);
  broadcast('agents', getAgents());
  return { id: agent.id };
}
function updateAgentStatus(body, id) {
  const db = readDB();
  const agent = db.agents.find(a => a.id === id);
  if (agent) { 
    agent.status = body.status; 
    agent.updatedAt = now(); 
    writeDB(db);
    broadcast('agents', getAgents());
  }
  return { success: true };
}
function getTasks() { return readDB().tasks.sort((a, b) => b.createdAt - a.createdAt); }
function getInboxTasks() { return readDB().tasks.filter(t => t.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt); }
function createTask(body) {
  const db = readDB();
  const task = { id: Date.now().toString(), ...body, createdAt: now(), updatedAt: now() };
  if (!task.status) task.status = 'inbox';
  if (!task.estimatedDuration) task.estimatedDuration = body.estimatedDuration || null;
  if (!task.phase) task.phase = body.phase || null;
  db.tasks.push(task);
  writeDB(db);
  broadcast('tasks', getTasks());
  broadcast('activity', { type: 'task_created', message: `Task created: ${task.title}`, createdAt: now() });
  return { id: task.id };
}
function updateTaskStatus(body, id) {
  const db = readDB();
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    // GATE CHECK: block direct done-setting for phase tasks unless gate is met
    if (body.status === 'done' && task.phase && task.status !== 'done') {
      const taskReviews = db.reviews?.filter(r => r.taskId === id) || [];
      const latestByReviewer = {};
      for (const r of taskReviews) {
        if (!latestByReviewer[r.reviewerId] || r.createdAt > latestByReviewer[r.reviewerId].createdAt) {
          latestByReviewer[r.reviewerId] = r;
        }
      }
      const latestReviews = Object.values(latestByReviewer);
      const approveCount = latestReviews.filter(r => r.verdict === 'approve').length;
      const changesCount = latestReviews.filter(r => r.verdict === 'request_changes').length;
      const REFINER_ID = '1770111297174tzxwozvu8';
      const refinerApproved = latestReviews.some(r => r.reviewerId === REFINER_ID && r.verdict === 'approve');
      
      const gateApproved = approveCount >= 2 
        && changesCount === 0 
        && (task.phase === 'final_review' || refinerApproved);
      
      if (!gateApproved) {
        return { success: false, error: 'Approval gate not met. Phase tasks require 2+ approvals with 0 request_changes.' };
      }
    }
    task.status = body.status; 
    task.updatedAt = now();
    // Track when task started
    if (body.status === 'in_progress' && !task.startedAt) {
      task.startedAt = now();
    }
    // Track when task completed
    if (body.status === 'done' && !task.completedAt) {
      task.completedAt = now();
    }
    writeDB(db);
    broadcast('tasks', getTasks());
    broadcast('activity', { type: 'task_status', message: `Task moved to ${body.status}: ${task.title}`, createdAt: now() });
  }
  return { success: true };
}
function updateTask(body, id) {
  const db = readDB();
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    // GATE CHECK: block direct done-setting for phase tasks unless gate is met
    if (body.status === 'done' && task.phase && task.status !== 'done') {
      const taskReviews = db.reviews?.filter(r => r.taskId === id) || [];
      const latestByReviewer = {};
      for (const r of taskReviews) {
        if (!latestByReviewer[r.reviewerId] || r.createdAt > latestByReviewer[r.reviewerId].createdAt) {
          latestByReviewer[r.reviewerId] = r;
        }
      }
      const latestReviews = Object.values(latestByReviewer);
      const approveCount = latestReviews.filter(r => r.verdict === 'approve').length;
      const changesCount = latestReviews.filter(r => r.verdict === 'request_changes').length;
      const REFINER_ID = '1770111297174tzxwozvu8';
      const refinerApproved = latestReviews.some(r => r.reviewerId === REFINER_ID && r.verdict === 'approve');
      
      const gateApproved = approveCount >= 2 
        && changesCount === 0 
        && (task.phase === 'final_review' || refinerApproved);
      
      if (!gateApproved) {
        return { success: false, error: 'Approval gate not met. Phase tasks require 2+ approvals with 0 request_changes.' };
      }
    }
    // ... rest of existing update logic ...
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'id' && key !== 'createdAt') {
        task[key] = value;
      }
    }
    task.updatedAt = now();
    // Track when task started
    if (body.status === 'in_progress' && !task.startedAt) {
      task.startedAt = now();
    }
    // Track when task completed
    if (body.status === 'done' && !task.completedAt) {
      task.completedAt = now();
    }
    writeDB(db);
    broadcast('tasks', getTasks());
    if (body.status) {
      broadcast('activity', { type: 'task_status', message: `Task moved to ${body.status}: ${task.title}`, createdAt: now() });
    }
  }
  return { success: true };
}
function claimTask(body, id) {
  const db = readDB();
  const task = db.tasks.find(t => t.id === id);
  if (task) { 
    task.status = 'in_progress'; 
    task.assigneeIds = [body.agentId];
    task.claimedAt = now();
    task.claimedBy = body.agentId;
    if (!task.startedAt) {
      task.startedAt = now();
    }
    task.updatedAt = now(); 
    writeDB(db);
    broadcast('tasks', getTasks());
    broadcast('activity', { type: 'task_claimed', message: `Task claimed: ${task.title}`, agentId: body.agentId, createdAt: now() });
  }
  return { success: true };
}
function getTaskTimeline(body, id) {
  const db = readDB();
  const task = db.tasks.find(t => t.id === id);
  if (!task) return { error: 'Task not found' };
  
  const timeline = [];
  
  // Task creation
  if (task.createdAt) {
    timeline.push({
      type: 'created',
      timestamp: task.createdAt,
      label: 'Task created',
      description: `Created at ${new Date(task.createdAt).toLocaleString()}`
    });
  }
  
  // Task claimed
  if (task.claimedAt) {
    const claimedByAgent = db.agents.find(a => a.id === task.claimedBy);
    timeline.push({
      type: 'claimed',
      timestamp: task.claimedAt,
      label: 'Task claimed',
      description: `Claimed by ${claimedByAgent?.name || task.claimedBy || 'unknown agent'}`
    });
  }
  
  // Task started (in_progress)
  if (task.startedAt) {
    timeline.push({
      type: 'started',
      timestamp: task.startedAt,
      label: 'Work started',
      description: `Moved to in_progress at ${new Date(task.startedAt).toLocaleString()}`
    });
  }
  
  // Task completed
  if (task.completedAt) {
    timeline.push({
      type: 'completed',
      timestamp: task.completedAt,
      label: 'Task completed',
      description: `Marked as done at ${new Date(task.completedAt).toLocaleString()}`
    });
  }
  
  // Task cancelled
  if (task.cancelledAt) {
    timeline.push({
      type: 'cancelled',
      timestamp: task.cancelledAt,
      label: 'Task cancelled',
      description: `Cancelled at ${new Date(task.cancelledAt).toLocaleString()}`
    });
  }
  
  // Reviews for this task
  const taskReviews = db.reviews?.filter(r => r.taskId === id) || [];
  for (const review of taskReviews) {
    const reviewer = db.agents.find(a => a.id === review.reviewerId);
    timeline.push({
      type: 'review',
      timestamp: review.createdAt,
      label: `Review: ${review.verdict}`,
      description: `Reviewed by ${reviewer?.name || review.reviewerId}: ${review.comment?.substring(0, 100)}${review.comment?.length > 100 ? '...' : ''}`,
      verdict: review.verdict
    });
  }
  
  // Messages for this task
  const taskMessages = db.messages?.filter(m => m.taskId === id) || [];
  for (const msg of taskMessages) {
    const sender = db.agents.find(a => a.id === msg.fromAgentId);
    timeline.push({
      type: 'message',
      timestamp: msg.createdAt,
      label: 'Message posted',
      description: `From ${sender?.name || msg.fromAgentId || 'System'}: ${msg.content?.substring(0, 80)}${msg.content?.length > 80 ? '...' : ''}`
    });
  }
  
  // Sort timeline by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    taskId: id,
    taskTitle: task.title,
    currentStatus: task.status,
    estimatedDuration: task.estimatedDuration || null,
    phase: task.phase || null,
    timeline: timeline
  };
}
function deleteTask(body, id) {
  const db = readDB();
  const idx = db.tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    // Delete associated files first
    const filesDeleted = deleteTaskFiles(id);
    db.tasks.splice(idx, 1);
    writeDB(db);
    broadcast('tasks', getTasks());
    return { success: true, filesDeleted };
  }
  return { success: false, error: 'Task not found' };
}
function cancelTask(body, id) {
  const db = readDB();
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    task.status = 'cancelled';
    task.cancelledAt = now();
    task.cancelledBy = body.agentId || 'user';
    task.updatedAt = now();
    writeDB(db);
    broadcast('tasks', getTasks());
    broadcast('activity', { type: 'task_cancelled', message: `Task cancelled: ${task.title}`, createdAt: now() });
  }
  return { success: true };
}
function deleteAllTasks() {
  const db = readDB();
  db.tasks = [];
  writeDB(db);
  broadcast('tasks', getTasks());
  return { success: true, deleted: true };
}
function getTaskMessages(id) { return readDB().messages.filter(m => m.taskId === id).sort((a, b) => a.createdAt - b.createdAt); }
function createMessage(body) {
  const db = readDB();
  const msg = { id: Date.now().toString(), ...body, createdAt: now() };
  db.messages.push(msg);
  // Persist activity so it survives refresh
  const actObj = {
    id: 'msg-' + msg.id,
    type: 'message',
    message: body.content.substring(0, 120),
    agentId: body.fromAgentId,
    taskId: body.taskId,
    createdAt: now()
  };
  db.activities.push(actObj);
  writeDB(db);
  broadcast('activity', actObj);
  return { id: msg.id };
}
function getActivities() { return readDB().activities.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50); }
function getAllMessages() {
  const db = readDB();
  return (db.messages || []).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
}
function createActivity(body) {
  const db = readDB();
  const activity = { id: Date.now().toString(), ...body, createdAt: now() };
  db.activities.push(activity);
  writeDB(db);
  broadcast('activity', activity);
  return { id: activity.id };
}
function getNotifications(agentId) { return readDB().notifications.filter(n => n.mentionedAgentId === agentId && !n.delivered); }
function createNotification(body) {
  const db = readDB();
  const notif = { id: Date.now().toString(), ...body, delivered: false, createdAt: now() };
  db.notifications.push(notif);
  writeDB(db);
  broadcast('notification', notif);
  return { id: notif.id };
}
function markNotificationDelivered(id) {
  const db = readDB();
  const notif = db.notifications.find(n => n.id === id);
  if (notif) { notif.delivered = true; writeDB(db); }
  return { success: true };
}
function getDocuments() { return readDB().documents.sort((a, b) => b.createdAt - a.createdAt); }
function createDocument(body) {
  const db = readDB();
  const doc = { id: Date.now().toString(), ...body, createdAt: now() };
  db.documents.push(doc);
  writeDB(db);
  broadcast('activity', { type: 'document', message: `Document created: ${body.title}`, createdAt: now() });
  return { id: doc.id };
}
function initializeAgents() {
  const db = readDB();
  const agents = [
    { name: 'Scout', role: 'Researcher', sessionKey: 'agent:researcher:main' },
    { name: 'Scribe', role: 'Writer', sessionKey: 'agent:writer:main' },
    { name: 'Surveyor', role: 'Analyst', sessionKey: 'agent:surveyor:main' },
    { name: 'Forge', role: 'Developer', sessionKey: 'agent:forge:main' },
    { name: 'Refiner', role: 'Editor', sessionKey: 'agent:refiner:main' },
    { name: 'Marshal', role: 'Executor', sessionKey: 'agent:marshal:main' },
  ];
  for (const a of agents) {
    if (!db.agents.find(existing => existing.sessionKey === a.sessionKey)) {
      db.agents.push({ ...a, id: Date.now().toString() + Math.random().toString(36).substr(2, 9), status: 'idle', currentTaskId: null, createdAt: now(), updatedAt: now() });
    }
  }
  writeDB(db);
  broadcast('agents', getAgents());
  return { success: true, count: agents.length };
}

// ========== PEER REVIEW SYSTEM ==========
function getTaskReviews(body, taskId) {
  const db = readDB();
  return db.reviews?.filter(r => r.taskId === taskId).sort((a, b) => b.createdAt - a.createdAt) || [];
}

function createReview(body, taskId) {
  const db = readDB();
  if (!db.reviews) db.reviews = [];
  
  const review = {
    id: Date.now().toString(),
    taskId: taskId,
    reviewerId: body.reviewerId,
    verdict: body.verdict, // 'approve', 'reject', 'request_changes', 'praise', 'critique'
    comment: body.comment,
    isAnonymous: body.isAnonymous ?? true,
    createdAt: now()
  };
  
  db.reviews.push(review);
  
  // Update agent stats
  updateAgentStats(body.reviewerId, 'reviewsGiven', 1);
  const task = db.tasks.find(t => t.id === taskId);
  if (task?.assigneeIds?.[0]) {
    updateAgentStats(task.assigneeIds[0], 'reviewsReceived', 1);
    if (body.verdict === 'praise') updateAgentStats(task.assigneeIds[0], 'praiseCount', 1);
    if (body.verdict === 'reject') updateAgentStats(task.assigneeIds[0], 'rejectCount', 1);
  }
  
  // === APPROVAL GATE (latest review per reviewer) ===
  const taskReviews = db.reviews?.filter(r => r.taskId === taskId) || [];
  
  // Group by reviewerId, take latest (by createdAt)
  const latestByReviewer = {};
  for (const r of taskReviews) {
    if (!latestByReviewer[r.reviewerId] || r.createdAt > latestByReviewer[r.reviewerId].createdAt) {
      latestByReviewer[r.reviewerId] = r;
    }
  }
  const latestReviews = Object.values(latestByReviewer);
  
  const approveCount = latestReviews.filter(r => r.verdict === 'approve').length;
  const changesCount = latestReviews.filter(r => r.verdict === 'request_changes').length;
  const REFINER_ID = '1770111297174tzxwozvu8';
  const refinerApproved = latestReviews.some(r => r.reviewerId === REFINER_ID && r.verdict === 'approve');
  
  if (task && task.status === 'review') {
    const isPhaseTask = !!task.phase;
    let gateApproved = false;
    
    if (isPhaseTask) {
      // Phase task gate: 2+ approvals, 0 request_changes, Refiner approved (except final_review)
      gateApproved = approveCount >= 2 
        && changesCount === 0 
        && (task.phase === 'final_review' || refinerApproved);
    } else {
      // Simple task gate: 2+ approvals, 0 request_changes
      gateApproved = approveCount >= 2 && changesCount === 0;
    }
    
    if (gateApproved) {
      task.status = 'done';
      task.completedAt = now();
      if (task.assigneeIds?.[0]) {
        updateAgentStats(task.assigneeIds[0], 'tasksCompleted', 1);
        updateAgentStats(task.assigneeIds[0], 'score', 10);
      }
    } else if (changesCount >= 2 && approveCount < 2) {
      // Revert to in_progress if 2+ request_changes
      task.status = 'in_progress';
      task.updatedAt = now();
    }
    writeDB(db);
    broadcast('tasks', getTasks());
  }
  
  writeDB(db);
  broadcast('activity', {
    type: 'review',
    message: `New ${body.verdict} on task by ${review.isAnonymous ? 'anonymous reviewer' : body.reviewerId}`,
    createdAt: now()
  });
  
  return { id: review.id };
}

// ========== AGENT GROWTH SYSTEM ==========
function updateAgentStats(agentId, stat, delta) {
  const db = readDB();
  const agent = db.agents.find(a => a.id === agentId || a.sessionKey === `agent:${agentId}:main`);
  if (!agent) return;
  
  if (!agent.stats) {
    agent.stats = {
      tasksCompleted: 0,
      reviewsGiven: 0,
      reviewsReceived: 0,
      praiseCount: 0,
      rejectCount: 0,
      score: 0,
      accuracyScore: 100
    };
  }
  
  agent.stats[stat] = (agent.stats[stat] || 0) + delta;
  agent.updatedAt = now();
  writeDB(db);
}

function getAgentStats(agentId) {
  const db = readDB();
  const agent = db.agents.find(a => a.id === agentId);
  return agent?.stats || null;
}

// ========== ANTI-COLLUSION: RANDOM REVIEWER ASSIGNMENT ==========
function assignRandomReviewers(body, taskId) {
  const count = body.count || 2;
  const db = readDB();
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return { error: 'Task not found' };
  
  // Exclude task owner from reviewers
  const ownerId = task.assigneeIds?.[0];
  const availableAgents = db.agents.filter(a => a.id !== ownerId && a.status !== 'busy');
  
  // Shuffle and pick
  const shuffled = availableAgents.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  
  // Create pending review assignments
  if (!db.pendingReviews) db.pendingReviews = [];
  for (const agent of selected) {
    db.pendingReviews.push({
      id: Date.now().toString() + Math.random(),
      taskId,
      reviewerId: agent.id,
      assignedAt: now(),
      status: 'pending'
    });
  }
  
  writeDB(db);
  return { assigned: selected.map(a => a.name) };
}

// Route matching
const routes = {
  'GET /api/agents': getAgents,
  'POST /api/agents': createAgent,
  'PATCH /api/agents/:id/status': updateAgentStatus,
  'GET /api/agents/:id/stats': getAgentStats,
  'GET /api/tasks': getTasks,
  'GET /api/tasks/inbox': getInboxTasks,
  'POST /api/tasks': createTask,
  'PATCH /api/tasks/:id/status': updateTaskStatus,
  'PATCH /api/tasks/:id': updateTask,
  'POST /api/tasks/:id/claim': claimTask,
  'POST /api/tasks/:id/cancel': cancelTask,
  'DELETE /api/tasks/:id': deleteTask,
  'DELETE /api/tasks': deleteAllTasks,
  'GET /api/tasks/:id/messages': getTaskMessages,
  'GET /api/tasks/:id/reviews': getTaskReviews,
  'GET /api/tasks/:id/timeline': getTaskTimeline,
  'POST /api/tasks/:id/reviews': createReview,
  'POST /api/tasks/:id/assign-reviewers': assignRandomReviewers,
  'POST /api/messages': createMessage,
  'GET /api/messages': getAllMessages,
  'GET /api/activities': getActivities,
  'POST /api/activities': createActivity,
  'GET /api/notifications/:agentId': getNotifications,
  'POST /api/notifications': createNotification,
  'PATCH /api/notifications/:id': markNotificationDelivered,
  'GET /api/documents': getDocuments,
  'POST /api/documents': createDocument,
  'POST /api/initialize': initializeAgents,
};

// File content handler
function handleTaskContent(req, res, taskId) {
  if (!checkAuth(req, res)) return;
  const fileData = getTaskFileContent(taskId);
  if (!fileData) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(fileData));
}

// File download handler
function handleTaskDownload(req, res, taskId) {
  if (!checkAuth(req, res)) return;
  const fileData = getTaskFileContent(taskId);
  if (!fileData) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileData.filename}"`,
  });
  res.end(fileData.content);
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // SSE endpoint
  if (req.url === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection message
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: now() })}\n\n`);

    sseClients.add(res);
    console.log(`SSE client connected. Total: ${sseClients.size}`);

    req.on('close', () => {
      sseClients.delete(res);
      console.log(`SSE client disconnected. Total: ${sseClients.size}`);
    });
    return;
  }

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;
  const method = req.method;

  // Check for file content/download routes first
  const contentMatch = path.match(/^\/api\/tasks\/([^\/]+)\/content$/);
  if (contentMatch && method === 'GET') {
    return handleTaskContent(req, res, contentMatch[1]);
  }
  
  const downloadMatch = path.match(/^\/api\/tasks\/([^\/]+)\/download$/);
  if (downloadMatch && method === 'GET') {
    return handleTaskDownload(req, res, downloadMatch[1]);
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const bodyObj = body ? JSON.parse(body) : {};
      
      // Find matching route
      let handler = null;
      let paramId = null;

      for (const [route, h] of Object.entries(routes)) {
        const [routeMethod, routePath] = route.split(' ');
        if (routeMethod !== method) continue;
        
        const routeParts = routePath.split('/');
        const pathParts = path.split('/');
        
        if (routeParts.length !== pathParts.length) continue;
        
        let match = true;
        let matchedParamId = null;
        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i].startsWith(':')) {
            matchedParamId = pathParts[i];
          } else if (routeParts[i] !== pathParts[i]) {
            match = false;
            break;
          }
        }
        if (match) { paramId = matchedParamId; handler = h; break; }
      }

      if (handler) {
        const response = handler(bodyObj, paramId);
        res.writeHead(200);
        res.end(JSON.stringify(response));
      } else if (method === 'GET' && path === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Mission Control API Running');
      } else if (method === 'GET' && path === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', clients: sseClients.size }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found', path }));
      }
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(3210, () => {
  console.log('🚀 Mission Control API running on http://localhost:3210');
  console.log('📡 SSE endpoint: http://localhost:3210/api/events');
  console.log(`📁 Database: ${DB_PATH}`);
});
