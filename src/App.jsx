import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'mc-dev-token-2024';


const apiFetch = (url, options = {}) => {
  const sep = url.includes("?") ? "&" : "?";
  return fetch(`${url}${sep}token=${API_TOKEN}`, options);
};
// Phase configuration
const PHASE_ORDER = ['research', 'design', 'build', 'documentation', 'final_review'];
const PHASE_COLORS = {
  research: '#60a5fa',
  design: '#a78bfa',
  build: '#fb923c',
  documentation: '#34d399',
  final_review: '#f472b6'
};
const PHASE_LABELS = {
  research: 'Research',
  design: 'Design',
  build: 'Build',
  documentation: 'Docs',
  final_review: 'Review'
};

const TABS = [
  { id: 'projects', label: 'Projects', icon: '◆' },
  { id: 'tasks', label: 'Tasks', icon: '◎' },
  { id: 'activity', label: 'Activity', icon: '◈' },
  { id: 'messages', label: 'Messages', icon: '◉' },
  { id: 'events', label: 'Events', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
];

// Agent emoji avatars
const AGENT_EMOJI = {
  Scout: '🔭',
  Scribe: '📝',
  Surveyor: '📐',
  Forge: '⚒️',
  Refiner: '🔍',
  Marshal: '📋'
};

// Event type styling
const EVENT_ICONS = {
  'task.created': { icon: '📋', color: '#60a5fa' },
  'task.claimed': { icon: '✋', color: '#a78bfa' },
  'task.status_changed': { icon: '🔄', color: '#fbbf24' },
  'task.stale_recovered': { icon: '⚠️', color: '#ef4444' },
  'task.deleted': { icon: '🗑️', color: '#6b7280' },
  'review.submitted': { icon: '⭐', color: '#f472b6' },
  'message.created': { icon: '💬', color: '#34d399' },
  'policy.updated': { icon: '⚙️', color: '#818cf8' },
  'trigger.fired': { icon: '🎯', color: '#fb923c' },
  'trigger.created': { icon: '➕', color: '#fb923c' },
  'reaction.fired': { icon: '🎲', color: '#e879f9' },
  'reaction.created': { icon: '➕', color: '#e879f9' },
  'system.heartbeat': { icon: '💓', color: '#6b7280' },
};

export default function App() {
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messagesTaskId, setMessagesTaskId] = useState(null);
  const [taskMessages, setTaskMessages] = useState([]);
  const [reviewTaskId, setReviewTaskId] = useState(null);
  const [allMessages, setAllMessages] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');

  // Sprint 3: Events, Policies, Triggers, Reactions
  const [events, setEvents] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [eventFilter, setEventFilter] = useState('all');
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyValue, setPolicyValue] = useState('');
  const [systemStats, setSystemStats] = useState(null);

  // Form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const activitiesRef = useRef([]);

  // Toast helper functions
  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now().toString();
    const toast = { id, message, type, createdAt: Date.now() };
    setToasts(prev => [toast, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchData = useCallback(async () => {
    try {
      const [aRes, tRes, actRes, mRes, evtRes, polRes, trgRes, rxnRes, statsRes] = await Promise.all([
        apiFetch(`${API_URL}/api/agents`),
        apiFetch(`${API_URL}/api/tasks`),
        apiFetch(`${API_URL}/api/activities`),
        apiFetch(`${API_URL}/api/messages`),
        apiFetch(`${API_URL}/api/events/list`).catch(() => ({ json: () => [] })),
        apiFetch(`${API_URL}/api/policies`).catch(() => ({ json: () => [] })),
        apiFetch(`${API_URL}/api/triggers`).catch(() => ({ json: () => [] })),
        apiFetch(`${API_URL}/api/reactions`).catch(() => ({ json: () => [] })),
        apiFetch(`${API_URL}/api/admin/stats`).catch(() => ({ json: () => null })),
      ]);
      setAgents(await aRes.json());
      setTasks(await tRes.json());
      const act = await actRes.json();
      activitiesRef.current = act;
      setActivities(act);
      const msgData = await mRes.json();
      setAllMessages(Array.isArray(msgData) ? msgData : []);
      const evtData = await evtRes.json();
      setEvents(Array.isArray(evtData) ? evtData : []);
      const polData = await polRes.json();
      setPolicies(Array.isArray(polData) ? polData : []);
      setTriggers(await trgRes.json());
      setReactions(await rxnRes.json());
      setSystemStats(await statsRes.json());
      setLastUpdate(new Date());
    } catch (e) { console.error('Fetch error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const timeInt = setInterval(() => setCurrentTime(new Date()), 1000);
    const pollInt = setInterval(fetchData, 5000);

    let es, timeout;
    const connect = () => {
      try {
        es = new EventSource(`${API_URL}/api/events?token=${API_TOKEN}`);
        es.onopen = () => setConnected(true);
        es.addEventListener('connected', () => setConnected(true));
        es.addEventListener('agents', e => setAgents(JSON.parse(e.data)));
        es.addEventListener('tasks', e => {
          const newTasks = JSON.parse(e.data);
          setTasks(newTasks);
        });
        es.addEventListener('activity', e => {
          const activity = JSON.parse(e.data);
          activitiesRef.current = [activity, ...activitiesRef.current].slice(0, 50);
          setActivities([...activitiesRef.current]);
          setLastUpdate(new Date());
          
          if (activity.type === 'task_claimed') {
            const agent = agents.find(a => a.id === activity.agentId);
            addToast(`${agent?.name || 'Agent'} claimed a task`, 'claim');
          } else if (activity.type === 'task_status') {
            addToast(activity.message, 'status');
          } else if (activity.type === 'task_cancelled') {
            addToast(activity.message, 'warning');
          }
        });
        es.addEventListener('event', e => {
          const evt = JSON.parse(e.data);
          setEvents(prev => [evt, ...prev].slice(0, 100));
          // Toast for interesting events
          if (evt.type === 'trigger.fired') {
            addToast(`🎯 Trigger: ${evt.data?.triggerName || 'fired'}`, 'info');
          } else if (evt.type === 'reaction.fired') {
            addToast(`🎲 ${evt.data?.targetAgent} reacted (${evt.data?.reactionType})`, 'info');
          } else if (evt.type === 'task.stale_recovered') {
            addToast(`⚠️ Stale task recovered: ${evt.data?.title}`, 'warning');
          }
        });
        es.onerror = () => { setConnected(false); es?.close(); timeout = setTimeout(connect, 5000); };
      } catch (e) { console.error('SSE error:', e); }
    };
    connect();

    return () => { es?.close(); clearTimeout(timeout); clearInterval(timeInt); clearInterval(pollInt); };
  }, [fetchData, addToast, agents]);

  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // --- Data Classification ---
  const parentIds = new Set(tasks.filter(t => t.parentTaskId).map(t => t.parentTaskId));
  const projects = tasks.filter(t => parentIds.has(t.id));
  const simpleTasks = tasks.filter(t => !t.parentTaskId && !parentIds.has(t.id));
  const phaseTasks = tasks.filter(t => t.parentTaskId);

  // --- Agent Status Derivation ---
  const activeAgentIds = new Set(
    tasks
      .filter(t => t.status === 'in_progress' || t.status === 'review')
      .flatMap(t => t.assigneeIds || [])
  );

  // --- Activity Feed Filtering ---
  const NOISE_TYPES = ['heartbeat', 'marshal-heartbeat', 'system'];
  const cleanActivities = activities.filter(a => !NOISE_TYPES.includes(a.type));

  // --- Stats ---
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const claimedToday = tasks.filter(t => t.claimedAt && t.claimedAt >= todayStart).length;
  
  const claimedTasks = tasks.filter(t => t.claimedAt && t.createdAt);
  const avgTimeToClaim = claimedTasks.length > 0
    ? claimedTasks.reduce((sum, t) => sum + (t.claimedAt - t.createdAt), 0) / claimedTasks.length
    : 0;
  
  const stats = {
    projects: projects.length,
    active: tasks.filter(t => t.status === 'in_progress' || t.status === 'review').length,
    completed: tasks.filter(t => t.status === 'done').length,
    claimedToday,
    avgTimeToClaim
  };

  // --- API Actions ---
  const createTask = async () => {
    if (!newTitle.trim()) return;
    const body = { 
      title: newTitle.trim(), 
      description: newDesc.trim(), 
      status: 'inbox' 
    };
    await apiFetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    addToast('✅ Task created! Scout will pick this up shortly.', 'create');
    setNewTitle(''); setNewDesc(''); setCreateOpen(false);
  };

  const updateStatus = async (id, status) => {
    await apiFetch(`${API_URL}/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  };

  const deleteTask = async (id) => {
    await apiFetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
    setSelectedTask(null);
  };

  const claimTask = async (id, agentId) => {
    await apiFetch(`${API_URL}/api/tasks/${id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId })
    });
  };

  const viewTaskFile = async (taskId) => {
    try {
      const res = await apiFetch(`${API_URL}/api/tasks/${taskId}/content?token=${API_TOKEN}`);
      if (!res.ok) { alert('File not found or unauthorized'); return; }
      const data = await res.json();
      setViewingFile(data);
      setFileViewerOpen(true);
    } catch (e) { console.error(e); alert('Failed to load file'); }
  };

  const downloadTaskFile = (taskId) => {
    window.open(`${API_URL}/api/tasks/${taskId}/download?token=${API_TOKEN}`, '_blank');
  };

  const cancelTask = async (id) => {
    await apiFetch(`${API_URL}/api/tasks/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'user' })
    });
    setSelectedTask(null);
  };

  const showConfirm = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const executeConfirm = async () => {
    if (confirmAction) await confirmAction();
    setConfirmOpen(false);
    setConfirmAction(null);
  };

  const deleteTaskWithConfirm = (id) => {
    showConfirm(
      'This will permanently delete the task and its output files.',
      async () => {
        const res = await apiFetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.filesDeleted) {
          alert(`Task deleted. ${data.filesDeleted} file(s) removed.`);
        }
        setSelectedTask(null);
      }
    );
  };

  const loadReviews = async (taskId) => {
    try {
      setReviewTaskId(taskId);
      const res = await apiFetch(`${API_URL}/api/tasks/${taskId}/reviews`);
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : []);
      setReviewOpen(true);
      // Delay closing task detail to ensure smooth transition
      setTimeout(() => setSelectedTask(null), 100);
    } catch (e) {
      console.error('Failed to load reviews:', e);
      setReviews([]);
    }
  };

  const loadTaskMessages = async (taskId) => {
    try {
      setMessagesTaskId(taskId);
      const res = await apiFetch(`${API_URL}/api/tasks/${taskId}/messages`);
      const data = await res.json();
      setTaskMessages(Array.isArray(data) ? data : []);
      setMessagesOpen(true);
      // Delay closing task detail to ensure smooth transition
      setTimeout(() => setSelectedTask(null), 100);
    } catch (e) {
      console.error('Failed to load messages:', e);
      setTaskMessages([]);
    }
  };

  const submitReview = async (taskId, verdict, comment) => {
    await apiFetch(`${API_URL}/api/tasks/${taskId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId: 'user', verdict, comment, isAnonymous: false })
    });
    loadReviews(taskId);
  };

  const requestChanges = async (id) => {
    const feedback = prompt("What changes are needed?");
    if (!feedback) return;
    await apiFetch(`${API_URL}/api/tasks/${id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId: 'user', verdict: 'request_changes', comment: feedback, isAnonymous: false })
    });
    await apiFetch(`${API_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: id, content: `Changes Requested: ${feedback}`, fromAgentId: 'user' })
    });
    alert('Changes requested.');
    loadReviews(id);
  };

  // Sprint 3: Policy update
  const updatePolicy = async (key, value) => {
    try {
      await apiFetch(`${API_URL}/api/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      addToast(`✅ Policy "${key}" updated`, 'create');
      setEditingPolicy(null);
      fetchData();
    } catch (e) {
      addToast(`❌ Failed to update policy: ${e.message}`, 'warning');
    }
  };

  // Sprint 3: Toggle trigger/reaction enabled
  const toggleTrigger = async (id, enabled) => {
    await apiFetch(`${API_URL}/api/triggers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    fetchData();
  };

  const toggleReaction = async (id, enabled) => {
    await apiFetch(`${API_URL}/api/reactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    fetchData();
  };

  const resetTask = (id) => {
    showConfirm('Reset task to IN PROGRESS?', async () => {
      await updateStatus(id, 'in_progress');
      await apiFetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id, content: 'Task reset by User', fromAgentId: 'system' })
      });
    });
  };

  // --- Helpers ---
  const getAgentById = id => agents.find(a => a.id === id);
  
  const timeAgo = ts => {
    if (!ts) return '—';
    const d = currentTime.getTime() - ts;
    if (d < 60000) return 'Just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`;
    return `${Math.floor(d / 86400000)}d`;
  };

  const formatTime = ts => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = ts => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  const formatRunning = ts => {
    if (!ts) return '';
    const d = currentTime.getTime() - ts;
    const h = Math.floor(d / 3600000);
    const m = Math.floor((d % 3600000) / 60000);
    const s = Math.floor((d % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpan = (start, end) => {
    if (!start || !end) return '';
    const d = end - start;
    const m = Math.floor(d / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  };

  const formatDuration = (ms) => {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getStatusDot = status => {
    const colors = { 
      inbox: '#60a5fa', 
      in_progress: '#6366f1', 
      review: '#fbbf24', 
      done: '#22c55e', 
      cancelled: '#ef4444', 
      pending: '#6b7280' 
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = status => {
    const labels = { 
      inbox: 'Inbox', 
      in_progress: 'In Progress', 
      review: 'Review', 
      done: 'Done', 
      cancelled: 'Cancelled', 
      pending: 'Pending' 
    };
    return labels[status] || status;
  };

  const getProjectPhases = project => {
    const children = phaseTasks.filter(t => t.parentTaskId === project.id);
    return PHASE_ORDER.map(phase => {
      const child = children.find(c => c.phase === phase);
      return {
        phase,
        status: child?.status || 'pending',
        task: child
      };
    });
  };

  const getProjectProgress = project => {
    const phases = getProjectPhases(project);
    const done = phases.filter(p => p.status === 'done').length;
    return Math.round((done / PHASE_ORDER.length) * 100);
  };

  // Phase ownership
  const PHASE_OWNER_IDS = {
    research: '1770111297174zzzj0y4t0',
    design: '1770111297174eqxoahkhn',
    build: '17701112971746evcn0t2u',
    documentation: '1770111297174m3otnmfuc',
    final_review: '1770111297174tzxwozvu8'
  };

  const waitingAgentIds = new Set();
  const waitingAgentContext = {};
  projects.forEach(project => {
    const phases = getProjectPhases(project);
    const currentIdx = phases.findIndex(p => p.status === 'in_progress' || p.status === 'review');
    if (currentIdx >= 0 && currentIdx < PHASE_ORDER.length - 1) {
      const nextPhase = PHASE_ORDER[currentIdx + 1];
      const ownerId = PHASE_OWNER_IDS[nextPhase];
      if (ownerId && !activeAgentIds.has(ownerId)) {
        waitingAgentIds.add(ownerId);
        waitingAgentContext[ownerId] = PHASE_LABELS[nextPhase] + ' phase';
      }
    }
  });

  // Group messages by task
  const messagesByTask = (Array.isArray(allMessages) ? allMessages : []).reduce((acc, msg) => {
    const taskId = msg.taskId;
    if (!acc[taskId]) acc[taskId] = [];
    acc[taskId].push(msg);
    return acc;
  }, {});

  // Get task name for messages
  const getTaskName = taskId => {
    const task = tasks.find(t => t.id === taskId);
    return task?.title || 'Unknown Task';
  };

  if (loading) return (
    <div className="loading">
      <div className="spinner"></div>
      <p>Loading Mission Control...</p>
    </div>
  );

  return (
    <div className="app">
      {/* --- Header --- */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⌘</span>
            <span className="logo-text">Mission Control</span>
          </div>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#6366f1',
            background: 'rgba(99, 102, 241, 0.1)',
            padding: '2px 8px',
            borderRadius: '999px',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            marginLeft: '8px'
          }}>
            v4.0
          </div>
        </div>
        
        <div className="header-center">
          <div className="stat-pill">
            <span className="stat-dot" style={{background: '#6366f1'}}></span>
            <span className="stat-value">{stats.active}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-pill">
            <span className="stat-dot" style={{background: '#10b981'}}></span>
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">Done</span>
          </div>
          <div className="stat-pill">
            <span className="stat-dot" style={{background: '#f59e0b'}}></span>
            <span className="stat-value">{stats.claimedToday}</span>
            <span className="stat-label">Today</span>
          </div>
        </div>
        
        <div className="header-right">
          <button className="btn-icon" onClick={() => setDocsOpen(true)} title="Help">?</button>
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <span>+</span> New Task
          </button>
        </div>
      </header>

      {/* --- Main Layout --- */}
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Agents</span>
            <span className="sidebar-count">{agents.length}</span>
          </div>
          
          <div className="agents-list">
            {agents.map(agent => {
              const isActive = activeAgentIds.has(agent.id);
              const isWaiting = !isActive && waitingAgentIds.has(agent.id);
              const currentTask = tasks.find(t =>
                t.assigneeIds?.includes(agent.id) &&
                (t.status === 'in_progress' || t.status === 'review')
              );
              
              return (
                <div 
                  key={agent.id} 
                  className={`agent-card ${isActive ? 'active' : isWaiting ? 'waiting' : 'idle'}`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <div className="agent-avatar">{AGENT_EMOJI[agent.name] || agent.name[0]}</div>
                  <div className="agent-info">
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-role">{agent.role}</div>
                    <div className="agent-meta">
                      <span className={`status-dot ${isActive ? 'pulse' : ''}`} style={{
                        background: isActive ? '#22c55e' : isWaiting ? '#fbbf24' : '#6b7280'
                      }}></span>
                      <span className="agent-status">
                        {isActive ? 'Active' : isWaiting ? 'Waiting' : 'Idle'}
                      </span>
                    </div>
                    {isActive && currentTask && (
                      <div className="agent-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{width: '60%'}}></div>
                        </div>
                        <div className="agent-time">
                          <span>{formatTime(currentTask.startedAt || currentTask.claimedAt)}</span>
                          <span className="time-running">{formatRunning(currentTask.startedAt || currentTask.claimedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="main">
          {/* Tabs */}
          <div className="tabs">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={`${tab.label} (⌘${idx + 1})`}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="projects-grid">
                {projects.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">◆</div>
                    <h3>No projects yet</h3>
                    <p>Create a task to get started</p>
                  </div>
                )}
                {projects.map(project => {
                  const progress = getProjectProgress(project);
                  const phases = getProjectPhases(project);
                  const currentPhase = phases.find(p => p.status === 'in_progress' || p.status === 'review');
                  const currentPhaseName = currentPhase ? PHASE_LABELS[currentPhase.phase] : (progress === 100 ? 'Complete' : 'Not started');
                  const activePhaseAssignees = currentPhase?.task?.assigneeIds || [];
                  const currentAgent = activePhaseAssignees.length > 0 ? getAgentById(activePhaseAssignees[0]) : null;
                  
                  return (
                    <div key={project.id} className="project-card">
                      <div className="project-header">
                        <h3 className="project-title">
                          {currentAgent && <span style={{marginRight: '6px'}}>{AGENT_EMOJI[currentAgent.name]}</span>}
                          {project.title}
                        </h3>
                        <div className="project-progress">{progress}%</div>
                      </div>
                      
                      <p className="project-desc">{project.description || 'No description'}</p>
                      
                      <div className="phase-bar">
                        {phases.map((p, i) => (
                          <div 
                            key={p.phase}
                            className={`phase-segment ${p.status}`}
                            style={{ 
                              backgroundColor: p.status === 'done' ? PHASE_COLORS[p.phase] : 
                                              p.status === 'in_progress' || p.status === 'review' ? PHASE_COLORS[p.phase] : '#1e1e28'
                            }}
                            title={`${PHASE_LABELS[p.phase]}: ${p.status}`}
                          />
                        ))}
                      </div>
                      
                      <div className="project-meta">
                        <div className="phase-badge" style={{ 
                          color: currentPhase ? PHASE_COLORS[currentPhase.phase] : progress === 100 ? '#22c55e' : '#6b7280',
                          borderColor: currentPhase ? PHASE_COLORS[currentPhase.phase] : progress === 100 ? '#22c55e' : '#1e1e28'
                        }}>
                          {currentPhase ? `Phase ${PHASE_ORDER.indexOf(currentPhase.phase) + 1}/5` : progress === 100 ? 'Complete' : 'Not Started'}
                        </div>
                        <span className="phase-name" style={{ color: currentPhase ? PHASE_COLORS[currentPhase.phase] : '#6b7280' }}>
                          {currentPhaseName}
                        </span>
                      </div>
                      
                      <div className="project-footer">
                        <div className="project-assignees">
                          {activePhaseAssignees.length > 0 ? (
                            activePhaseAssignees.map(id => {
                              const a = getAgentById(id);
                              return a ? (
                                <div key={id} className="assignee-avatar" title={a.name}>
                                  {a.name[0]}
                                </div>
                              ) : null;
                            })
                          ) : (
                            (project.assigneeIds || []).map(id => {
                              const a = getAgentById(id);
                              return a ? (
                                <div key={id} className="assignee-avatar" title={a.name}>
                                  {a.name[0]}
                                </div>
                              ) : null;
                            })
                          )}
                        </div>
                        <div className="project-time">
                          <span>{formatTime(project.createdAt)}</span>
                          <span className="time-ago">{timeAgo(project.createdAt)}</span>
                        </div>
                      </div>
                      
                      <div className="project-actions">
                        <button className="btn-ghost" onClick={() => setSelectedProject(project)}>
                          View
                        </button>
                        <button className="btn-ghost" onClick={() => loadTaskMessages(project.id)}>
                          Messages
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="tasks-container">
                <div className="table-header">
                  <div className="th-status">Status</div>
                  <div className="th-title">Title</div>
                  <div className="th-assigned">Assigned</div>
                  <div className="th-time">Time</div>
                </div>
                
                <div className="task-list">
                  {simpleTasks.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">◎</div>
                      <h3>No tasks yet</h3>
                      <p>Create a task to get started</p>
                    </div>
                  )}
                  
                  {simpleTasks.filter(t => ['inbox', 'in_progress', 'review'].includes(t.status)).map(task => (
                    <div 
                      key={task.id} 
                      className="task-row"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="td-status">
                        <span className="status-indicator" style={{background: getStatusDot(task.status)}}></span>
                        <span className="status-text">{getStatusLabel(task.status)}</span>
                      </div>
                      <div className="td-title">
                        <span className="task-title-text">{task.title}</span>
                        {task.estimatedDuration && (
                          <span className="task-est">{task.estimatedDuration}</span>
                        )}
                      </div>
                      <div className="td-assigned">
                        {(task.assigneeIds || []).map(id => {
                          const a = getAgentById(id);
                          return a ? (
                            <div key={id} className="assignee-avatar-sm" title={a.name}>
                              {a.name[0]}
                            </div>
                          ) : null;
                        })}
                      </div>
                      <div className="td-time">
                        <span>{timeAgo(task.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  
                  {simpleTasks.filter(t => t.status === 'done').length > 0 && (
                    <>
                      <div className="task-divider">Completed</div>
                      {simpleTasks.filter(t => t.status === 'done').map(task => (
                        <div 
                          key={task.id} 
                          className="task-row done"
                          onClick={() => setSelectedTask(task)}
                        >
                          <div className="td-status">
                            <span className="status-indicator" style={{background: getStatusDot(task.status)}}></span>
                            <span className="status-text">{getStatusLabel(task.status)}</span>
                          </div>
                          <div className="td-title">
                            <span className="task-title-text">{task.title}</span>
                          </div>
                          <div className="td-assigned">
                            {(task.assigneeIds || []).map(id => {
                              const a = getAgentById(id);
                              return a ? (
                                <div key={id} className="assignee-avatar-sm" title={a.name}>
                                  {a.name[0]}
                                </div>
                              ) : null;
                            })}
                          </div>
                          <div className="td-time">
                            <span>{timeAgo(task.completedAt || task.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {simpleTasks.filter(t => t.status === 'cancelled').length > 0 && (
                    <>
                      <div className="task-divider">Cancelled</div>
                      {simpleTasks.filter(t => t.status === 'cancelled').map(task => (
                        <div 
                          key={task.id} 
                          className="task-row cancelled"
                          onClick={() => setSelectedTask(task)}
                        >
                          <div className="td-status">
                            <span className="status-indicator" style={{background: getStatusDot(task.status)}}></span>
                            <span className="status-text">{getStatusLabel(task.status)}</span>
                          </div>
                          <div className="td-title">
                            <span className="task-title-text">{task.title}</span>
                          </div>
                          <div className="td-assigned">—</div>
                          <div className="td-time">
                            <span>{timeAgo(task.cancelledAt || task.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="activity-container">
                <div className="activity-filters">
                  {['all', 'tasks', 'claims', 'reviews'].map(f => (
                    <button 
                      key={f} 
                      className={`filter-chip ${activityFilter === f ? 'active' : ''}`}
                      onClick={() => setActivityFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                
                <div className="activity-timeline">
                  {cleanActivities.filter(a => {
                    if (activityFilter === 'all') return true;
                    if (activityFilter === 'tasks') return a.type?.includes('task') || a.type === 'phase_transition';
                    if (activityFilter === 'claims') return a.type === 'task_claimed';
                    if (activityFilter === 'reviews') return a.type?.includes('review');
                    return true;
                  }).length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">◈</div>
                      <h3>No activity yet</h3>
                      <p>Check back soon for updates</p>
                    </div>
                  )}
                  
                  {cleanActivities.filter(a => {
                    if (activityFilter === 'all') return true;
                    if (activityFilter === 'tasks') return a.type?.includes('task') || a.type === 'phase_transition';
                    if (activityFilter === 'claims') return a.type === 'task_claimed';
                    if (activityFilter === 'reviews') return a.type?.includes('review');
                    return true;
                  }).slice(0, 50).map((activity, i) => {
                    const agent = activity.agentId ? getAgentById(activity.agentId) : null;
                    const isClaim = activity.type === 'task_claimed';
                    const isPhase = activity.type === 'phase_transition';
                    const actTask = activity.taskId ? tasks.find(t => t.id === activity.taskId) : null;
                    
                    let icon = '◆';
                    if (isClaim) icon = '✓';
                    if (isPhase) icon = '↻';
                    if (activity.type === 'review') icon = '★';
                    if (activity.type?.includes('message')) icon = '◉';
                    
                    return (
                      <div 
                        key={activity.id || i} 
                        className="timeline-item"
                        onClick={() => actTask && setSelectedTask(actTask)}
                        style={{cursor: actTask ? 'pointer' : 'default'}}
                      >
                        <div className="timeline-marker">
                          <div className={`timeline-icon ${isClaim ? 'claim' : isPhase ? 'phase' : ''}`}>
                            {agent && AGENT_EMOJI[agent.name] ? AGENT_EMOJI[agent.name] : icon}
                          </div>
                          {i < cleanActivities.length - 1 && <div className="timeline-line"></div>}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-agent">{agent?.name || 'System'}</span>
                            <span className="timeline-time">{formatTime(activity.createdAt)} • {timeAgo(activity.createdAt)}</span>
                          </div>
                          <p className="timeline-message">{activity.message}</p>
                          {actTask && (
                            <span className="timeline-task">{actTask.title}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="messages-container">
                {Object.keys(messagesByTask).length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">◉</div>
                    <h3>No messages yet</h3>
                    <p>Messages will appear here when agents communicate</p>
                  </div>
                )}
                
                {Object.entries(messagesByTask).map(([taskId, msgs]) => {
                  const latestMsg = msgs[msgs.length - 1];
                  const taskName = getTaskName(taskId);
                  const unreadCount = msgs.filter(m => !m.read).length;
                  
                  return (
                    <div 
                      key={taskId} 
                      className="message-thread"
                      onClick={() => loadTaskMessages(taskId)}
                    >
                      <div className="thread-header">
                        <div className="thread-avatars">
                          {[...new Set(msgs.map(m => m.fromAgentId))].slice(0, 3).map((agentId, i) => {
                            const agent = getAgentById(agentId);
                            return agent ? (
                              <div key={i} className="thread-avatar">{agent.name[0]}</div>
                            ) : (
                              <div key={i} className="thread-avatar system">⚙</div>
                            );
                          })}
                        </div>
                        <div className="thread-info">
                          <h4 className="thread-title">{taskName}</h4>
                          <p className="thread-preview">{latestMsg?.content?.substring(0, 60)}...</p>
                        </div>
                        <div className="thread-meta">
                          <span className="thread-time">{timeAgo(latestMsg?.createdAt)}</span>
                          {unreadCount > 0 && (
                            <span className="thread-badge" title={`${unreadCount} unread messages`}>
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Events Tab */}
            {activeTab === 'events' && (
              <div className="events-container">
                <div className="events-header-row">
                  <div className="activity-filters">
                    {['all', 'tasks', 'reviews', 'triggers', 'reactions', 'system'].map(f => (
                      <button 
                        key={f} 
                        className={`filter-chip ${eventFilter === f ? 'active' : ''}`}
                        onClick={() => setEventFilter(f)}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  {systemStats && (
                    <div className="events-stats">
                      <span className="stat-mini">⚡ {systemStats.events?.last24h || 0} events/24h</span>
                      <span className="stat-mini">📋 {systemStats.tasks?.total || 0} tasks</span>
                      <span className="stat-mini">🤖 {systemStats.agents?.total || 0} agents</span>
                    </div>
                  )}
                </div>
                
                <div className="event-stream">
                  {events.filter(e => {
                    if (eventFilter === 'all') return true;
                    if (eventFilter === 'tasks') return e.type?.startsWith('task.');
                    if (eventFilter === 'reviews') return e.type?.startsWith('review.');
                    if (eventFilter === 'triggers') return e.type?.startsWith('trigger.');
                    if (eventFilter === 'reactions') return e.type?.startsWith('reaction.');
                    if (eventFilter === 'system') return e.type?.startsWith('system.') || e.type?.startsWith('policy.');
                    return true;
                  }).length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">⚡</div>
                      <h3>No events yet</h3>
                      <p>Events will stream here as the system operates</p>
                    </div>
                  )}
                  
                  {events.filter(e => {
                    if (eventFilter === 'all') return true;
                    if (eventFilter === 'tasks') return e.type?.startsWith('task.');
                    if (eventFilter === 'reviews') return e.type?.startsWith('review.');
                    if (eventFilter === 'triggers') return e.type?.startsWith('trigger.');
                    if (eventFilter === 'reactions') return e.type?.startsWith('reaction.');
                    if (eventFilter === 'system') return e.type?.startsWith('system.') || e.type?.startsWith('policy.');
                    return true;
                  }).slice(0, 100).map((evt, i) => {
                    const style = EVENT_ICONS[evt.type] || { icon: '●', color: '#6b7280' };
                    const agent = evt.agentId ? getAgentById(evt.agentId) : null;
                    const task = evt.taskId ? tasks.find(t => t.id === evt.taskId) : null;
                    
                    return (
                      <div key={evt.id || i} className="event-row">
                        <div className="event-icon" style={{ color: style.color }}>{style.icon}</div>
                        <div className="event-body">
                          <div className="event-type" style={{ color: style.color }}>{evt.type}</div>
                          <div className="event-details">
                            {agent && <span className="event-agent">{AGENT_EMOJI[agent.name] || '🤖'} {agent.name}</span>}
                            {task && <span className="event-task" onClick={() => setSelectedTask(task)} style={{cursor:'pointer'}}>📋 {task.title}</span>}
                            {evt.data?.message && <span className="event-message">{evt.data.message}</span>}
                            {evt.data?.triggerName && !evt.data?.message && <span className="event-detail">trigger: {evt.data.triggerName}</span>}
                            {evt.data?.reactionName && <span className="event-detail">reaction: {evt.data.reactionName} → {evt.data.targetAgent}</span>}
                            {evt.data?.verdict && <span className={`event-verdict ${evt.data.verdict}`}>{evt.data.verdict}</span>}
                            {evt.data?.from && evt.data?.to && <span className="event-detail">{evt.data.from} → {evt.data.to}</span>}
                            {evt.data?.key && <span className="event-detail">policy: {evt.data.key}</span>}
                          </div>
                        </div>
                        <div className="event-time">{timeAgo(evt.createdAt)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Settings Tab — Policies, Triggers, Reactions */}
            {activeTab === 'settings' && (
              <div className="settings-container">
                {/* System Overview */}
                {systemStats && (
                  <div className="settings-section">
                    <h3 className="section-title">📊 System Overview</h3>
                    <div className="stats-overview">
                      <div className="overview-stat"><span className="overview-value">{systemStats.agents?.total}</span><span className="overview-label">Agents</span></div>
                      <div className="overview-stat"><span className="overview-value">{systemStats.tasks?.total}</span><span className="overview-label">Tasks</span></div>
                      <div className="overview-stat"><span className="overview-value">{systemStats.events?.last24h}</span><span className="overview-label">Events/24h</span></div>
                      <div className="overview-stat"><span className="overview-value">{systemStats.policies}</span><span className="overview-label">Policies</span></div>
                    </div>
                  </div>
                )}

                {/* Policies */}
                <div className="settings-section">
                  <h3 className="section-title">⚙️ Policies</h3>
                  <p className="section-desc">Runtime configuration — change behavior without redeploying</p>
                  <div className="policy-grid">
                    {policies.map(p => (
                      <div key={p.key || p.id} className="policy-card">
                        <div className="policy-header">
                          <span className="policy-key">{p.key}</span>
                          <button 
                            className="btn-ghost btn-sm"
                            onClick={() => {
                              setEditingPolicy(p.key);
                              setPolicyValue(JSON.stringify(p.value, null, 2));
                            }}
                          >
                            Edit
                          </button>
                        </div>
                        <div className="policy-desc">{p.description || '—'}</div>
                        {editingPolicy === p.key ? (
                          <div className="policy-edit">
                            <textarea 
                              className="input policy-input" 
                              value={policyValue} 
                              onChange={e => setPolicyValue(e.target.value)}
                              rows={3}
                            />
                            <div className="policy-actions">
                              <button className="btn-primary btn-sm" onClick={() => {
                                try {
                                  updatePolicy(p.key, JSON.parse(policyValue));
                                } catch (e) { addToast('Invalid JSON', 'warning'); }
                              }}>Save</button>
                              <button className="btn-secondary btn-sm" onClick={() => setEditingPolicy(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <pre className="policy-value">{JSON.stringify(p.value, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Triggers */}
                <div className="settings-section">
                  <h3 className="section-title">🎯 Triggers ({triggers.length})</h3>
                  <p className="section-desc">Auto-fire actions when conditions are met</p>
                  <div className="trigger-list">
                    {(Array.isArray(triggers) ? triggers : []).map(t => (
                      <div key={t.id} className={`trigger-card ${t.enabled ? '' : 'disabled'}`}>
                        <div className="trigger-header">
                          <span className="trigger-name">{t.name}</span>
                          <label className="toggle-switch">
                            <input type="checkbox" checked={t.enabled} onChange={() => toggleTrigger(t.id, !t.enabled)} />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                        <div className="trigger-meta">
                          <span className="trigger-event">on: <code>{t.eventType}</code></span>
                          {t.condition && <span className="trigger-condition">if: <code>{t.condition}</code></span>}
                          <span className="trigger-action">→ <code>{t.actionType}</code></span>
                          {t.cooldownMs > 0 && <span className="trigger-cooldown">⏱ {formatDuration(t.cooldownMs)}</span>}
                        </div>
                        {t.lastFiredAt && <div className="trigger-fired">Last fired: {timeAgo(t.lastFiredAt)}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reactions */}
                <div className="settings-section">
                  <h3 className="section-title">🎲 Reaction Matrix ({reactions.length})</h3>
                  <p className="section-desc">Probabilistic inter-agent responses to events</p>
                  <div className="reaction-list">
                    {(Array.isArray(reactions) ? reactions : []).map(r => (
                      <div key={r.id} className={`reaction-card ${r.enabled ? '' : 'disabled'}`}>
                        <div className="reaction-header">
                          <span className="reaction-name">{r.name}</span>
                          <div className="reaction-right">
                            <span className="reaction-prob" style={{
                              color: r.probability >= 0.8 ? '#22c55e' : r.probability >= 0.5 ? '#fbbf24' : '#6b7280'
                            }}>{Math.round(r.probability * 100)}%</span>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={r.enabled} onChange={() => toggleReaction(r.id, !r.enabled)} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                        </div>
                        <div className="reaction-meta">
                          <span>on: <code>{r.sourceEvent}</code></span>
                          <span>→ {AGENT_EMOJI[r.targetAgentName] || '🤖'} <strong>{r.targetAgentName}</strong></span>
                          <span className="reaction-type">{r.reactionType}</span>
                          {r.cooldownMs > 0 && <span>⏱ {formatDuration(r.cooldownMs)}</span>}
                        </div>
                        {r.messageTemplate && <div className="reaction-template">"{r.messageTemplate}"</div>}
                        {r.lastFiredAt && <div className="reaction-fired">Last fired: {timeAgo(r.lastFiredAt)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* --- Footer --- */}
      <footer className="footer">
        <div className="footer-left">
          <span className={`connection-dot ${connected ? 'online' : 'offline'}`}></span>
          <span>{connected ? 'Live' : 'Reconnecting'}</span>
        </div>
        <div className="footer-right">
          <span>{formatTime(lastUpdate.getTime())}</span>
        </div>
      </footer>

      {/* --- Modals --- */}

      {/* Create Task */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Task</h2>
              <button className="modal-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <label>Title</label>
              <input 
                className="input" 
                placeholder="What needs to be done?" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
                autoFocus 
                onKeyDown={e => e.key === 'Enter' && createTask()}
              />
              <label>Description</label>
              <textarea 
                className="input" 
                placeholder="More details (optional)..."
                value={newDesc} 
                onChange={e => setNewDesc(e.target.value)} 
                rows={3} 
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={createTask} disabled={!newTitle.trim()}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Project Detail */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedProject.title}</h2>
              <button className="modal-close" onClick={() => setSelectedProject(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">{selectedProject.description || 'No description.'}</p>
              
              <h3>Phase Timeline</h3>
              <div className="phase-list">
                {getProjectPhases(selectedProject).map(p => (
                  <div 
                    key={p.phase} 
                    className={`phase-item ${p.status}`}
                    onClick={() => p.task && setSelectedTask(p.task)}
                    style={{cursor: p.task ? 'pointer' : 'default'}}
                  >
                    <div className="phase-icon" style={{color: PHASE_COLORS[p.phase]}}>
                      {p.status === 'done' ? '✓' : p.status === 'in_progress' ? '●' : p.status === 'review' ? '◐' : '○'}
                    </div>
                    <div className="phase-details">
                      <span className="phase-name">{PHASE_LABELS[p.phase]}</span>
                      {p.task && (
                        <span className="phase-assignee">
                          {(p.task.assigneeIds || []).map(id => {
                            const a = getAgentById(id);
                            return a ? a.name : null;
                          }).filter(Boolean).join(', ') || 'Unassigned'}
                        </span>
                      )}
                    </div>
                    <span className="phase-status">{p.status.replace('_', ' ')}</span>
                    {p.task?.status === 'done' && p.task?.outputPath && (
                      <button 
                        className="btn-ghost btn-sm" 
                        onClick={(e) => { e.stopPropagation(); viewTaskFile(p.task.id); }}
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer modal-footer-between">
              <div className="footer-actions-left">
                {selectedProject.status !== 'cancelled' && selectedProject.status !== 'done' && (
                  <button className="btn-warning" onClick={() => { cancelTask(selectedProject.id); setSelectedProject(null); }}>Cancel</button>
                )}
              </div>
              <div className="footer-actions-right">
                <button className="btn-secondary" onClick={() => setSelectedProject(null)}>Close</button>
                <button className="btn-danger" onClick={() => { deleteTaskWithConfirm(selectedProject.id); setSelectedProject(null); }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedTask.title}</h2>
              <button className="modal-close" onClick={() => setSelectedTask(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">{selectedTask.description || 'No description.'}</p>

              <label>Status</label>
              <div className="status-selector">
                {['inbox', 'in_progress', 'review', 'done', 'cancelled'].map(s => (
                  <button
                    key={s}
                    className={`status-btn ${s === selectedTask.status ? 'active' : ''}`}
                    onClick={() => updateStatus(selectedTask.id, s)}
                    disabled={selectedTask.status === 'done' || selectedTask.status === 'cancelled'}
                    style={{'--status-color': getStatusDot(s)}}
                  >
                    <span className="status-dot-sm" style={{background: getStatusDot(s)}}></span>
                    {getStatusLabel(s)}
                  </button>
                ))}
              </div>

              <label>Assign Agent</label>
              <div className="agent-selector">
                {agents.map(a => {
                  const isAssigned = (selectedTask.assigneeIds || []).includes(a.id);
                  return (
                    <button 
                      key={a.id} 
                      className={`agent-chip ${isAssigned ? 'assigned' : ''}`}
                      onClick={() => claimTask(selectedTask.id, a.id)}
                      disabled={selectedTask.status === 'done' || selectedTask.status === 'cancelled'}
                    >
                      <span className="agent-chip-avatar">{a.name[0]}</span>
                      {a.name}
                    </button>
                  );
                })}
              </div>

              <div className="task-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Created</span>
                  <span className="meta-value">{formatDate(selectedTask.createdAt)} {formatTime(selectedTask.createdAt)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">ID</span>
                  <span className="meta-value code">{selectedTask.id}</span>
                </div>
              </div>

              {(selectedTask.outputPath || selectedTask.analysisPath) && (
                <div className="file-actions">
                  <button className="btn-primary" onClick={() => viewTaskFile(selectedTask.id)}>View File</button>
                  <button className="btn-secondary" onClick={() => downloadTaskFile(selectedTask.id)}>Download</button>
                </div>
              )}
            </div>
            <div className="modal-footer modal-footer-between">
              <div className="footer-actions-left">
                {selectedTask.status !== 'cancelled' && selectedTask.status !== 'done' && (
                  <button className="btn-warning" onClick={() => cancelTask(selectedTask.id)}>Cancel</button>
                )}
                {selectedTask.status !== 'done' && selectedTask.status !== 'cancelled' && (
                  <>
                    <button className="btn-secondary" onClick={() => requestChanges(selectedTask.id)}>Request Changes</button>
                    <button className="btn-secondary" onClick={() => resetTask(selectedTask.id)}>Reset</button>
                  </>
                )}
              </div>
              <div className="footer-actions-right">
                <button className="btn-secondary" onClick={() => loadTaskMessages(selectedTask.id)}>Messages</button>
                <button className="btn-secondary" onClick={() => loadReviews(selectedTask.id)}>Reviews</button>
                <button className="btn-danger" onClick={() => deleteTaskWithConfirm(selectedTask.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Docs */}
      {docsOpen && (
        <div className="modal-overlay" onClick={() => setDocsOpen(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mission Control Docs</h2>
              <button className="modal-close" onClick={() => setDocsOpen(false)}>×</button>
            </div>
            <div className="modal-body docs-body">
              <div className="docs-hero">
                <h1>Mission Control</h1>
                <p>6 autonomous agents working together to build projects</p>
              </div>

              <h3>How Agents Work</h3>
              <p>The agents work <strong>autonomously</strong> — no manual input needed once you create a task.</p>
              <ul>
                <li>Create work — Marshal auto-creates the next phase task when a phase is approved</li>
                <li>Claim tasks — Each agent picks up their assigned phase automatically</li>
                <li>Talk to each other — They post messages on tasks</li>
                <li>Review each other — Every agent reviews every phase's output</li>
              </ul>

              <h3>The Team</h3>
              <ul>
                <li><strong>Scout</strong> — Phase 1: Research</li>
                <li><strong>Surveyor</strong> — Phase 2: Design</li>
                <li><strong>Forge</strong> — Phase 3: Build</li>
                <li><strong>Scribe</strong> — Phase 4: Documentation</li>
                <li><strong>Refiner</strong> — Phase 5: Final Review</li>
                <li><strong>Marshal</strong> — Orchestrator</li>
              </ul>

              <h3>Workflow</h3>
              <div className="phase-flow">
                {PHASE_ORDER.map((p, i) => (
                  <span key={p} className="phase-tag" style={{color: PHASE_COLORS[p], borderColor: PHASE_COLORS[p]}}>
                    {i + 1}. {PHASE_LABELS[p]}
                  </span>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDocsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer */}
      {fileViewerOpen && viewingFile && (
        <div className="modal-overlay" onClick={() => setFileViewerOpen(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{viewingFile.filename}</h2>
              <button className="modal-close" onClick={() => setFileViewerOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {viewingFile.isMarkdown ? (
                <div 
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ 
                    __html: viewingFile.content
                      .replace(/# (.*)/g, '<h1>$1</h1>')
                      .replace(/## (.*)/g, '<h2>$1</h2>')
                      .replace(/### (.*)/g, '<h3>$1</h3>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/- (.*)/g, '<li>$1</li>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              ) : (
                <pre className="file-content">{viewingFile.content}</pre>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setFileViewerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm</h2>
              <button className="modal-close" onClick={() => setConfirmOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>{confirmMessage}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn-danger" onClick={executeConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviewOpen && (
        <div className="modal-overlay" onClick={() => setReviewOpen(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reviews</h2>
              <button className="modal-close" onClick={() => setReviewOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="reviews-list">
                {reviews.length === 0 && <p className="empty-text">No reviews yet.</p>}
                {reviews.map(r => {
                  const reviewer = getAgentById(r.reviewerId);
                  return (
                    <div key={r.id} className={`review-card ${r.verdict}`}>
                      <div className="review-header">
                        <span className="review-badge">{r.verdict}</span>
                        <span className="reviewer-name">{reviewer?.name || r.reviewerId}</span>
                        <span className="review-time">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="review-comment">{r.comment}</p>
                    </div>
                  );
                })}
              </div>
              
              <div className="review-form">
                <h4>Add Review</h4>
                <select id="review-verdict" className="input">
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="request_changes">Request Changes</option>
                  <option value="praise">Praise</option>
                  <option value="critique">Critique</option>
                </select>
                <textarea id="review-comment" className="input" placeholder="Your feedback..." rows={3} />
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    const verdict = document.getElementById('review-verdict').value;
                    const comment = document.getElementById('review-comment').value;
                    if (reviewTaskId) submitReview(reviewTaskId, verdict, comment);
                    document.getElementById('review-comment').value = '';
                  }}
                >
                  Submit Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {messagesOpen && (
        <div className="modal-overlay" onClick={() => setMessagesOpen(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Messages</h2>
              <button className="modal-close" onClick={() => setMessagesOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="messages-list">
                {taskMessages.length === 0 && <p className="empty-text">No messages yet.</p>}
                {taskMessages.map((m, i) => {
                  const sender = getAgentById(m.fromAgentId);
                  const isSystem = m.fromAgentId === 'system';
                  return (
                    <div key={m.id || i} className={`message-bubble-row ${isSystem ? 'system' : ''}`}>
                      <div className={`message-sender-avatar ${isSystem ? 'system' : ''}`}>
                        {isSystem ? '⚙' : sender ? sender.name[0] : '?'}
                      </div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="message-author">{sender?.name || m.fromAgentId || 'System'}</span>
                          <span className="message-timestamp">{formatTime(m.createdAt)} • {timeAgo(m.createdAt)}</span>
                        </div>
                        <p className="message-text">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMessagesOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Timeline */}
      {selectedAgent && (
        <div className="modal-overlay" onClick={() => setSelectedAgent(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedAgent.name}</h2>
              <button className="modal-close" onClick={() => setSelectedAgent(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="agent-profile">
                <div className={`agent-avatar-lg ${activeAgentIds.has(selectedAgent.id) ? 'active' : waitingAgentIds.has(selectedAgent.id) ? 'waiting' : 'idle'}`}>
                  {selectedAgent.name[0]}
                </div>
                <div className="agent-profile-info">
                  <h3>{selectedAgent.name}</h3>
                  <span className="agent-role">{selectedAgent.role}</span>
                  <span className={`agent-status-badge ${activeAgentIds.has(selectedAgent.id) ? 'active' : waitingAgentIds.has(selectedAgent.id) ? 'waiting' : 'idle'}`}>
                    {activeAgentIds.has(selectedAgent.id) ? 'Active' : waitingAgentIds.has(selectedAgent.id) ? 'Waiting' : 'Idle'}
                  </span>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-number">{selectedAgent.stats?.tasksCompleted || 0}</span>
                  <span className="stat-label">Completed</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{selectedAgent.stats?.reviewsGiven || 0}</span>
                  <span className="stat-label">Reviews</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number" style={{color: '#22c55e'}}>{selectedAgent.stats?.praiseCount || 0}</span>
                  <span className="stat-label">Praise</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number" style={{color: '#f59e0b'}}>{selectedAgent.stats?.critiqueCount || 0}</span>
                  <span className="stat-label">Critique</span>
                </div>
              </div>

              <h4>Work History</h4>
              {(() => {
                const agentTasks = tasks
                  .filter(t => t.assigneeIds?.includes(selectedAgent.id))
                  .sort((a, b) => (b.startedAt || b.claimedAt || b.createdAt) - (a.startedAt || a.claimedAt || a.createdAt));

                if (agentTasks.length === 0) return <p className="empty-text">No tasks assigned yet.</p>;

                return (
                  <div className="work-timeline">
                    {agentTasks.map(t => {
                      const startTs = t.startedAt || t.claimedAt || t.createdAt;
                      const isRunning = (t.status === 'in_progress' || t.status === 'review') && !t.completedAt;
                      return (
                        <div key={t.id} className="work-item" onClick={() => { setSelectedAgent(null); setSelectedTask(t); }}>
                          <div className="work-marker">
                            <div className={`work-dot ${t.status === 'done' ? 'done' : isRunning ? 'active' : ''}`}></div>
                          </div>
                          <div className="work-content">
                            <div className="work-title">{t.title}</div>
                            <div className="work-meta">
                              {t.phase && (
                                <span className="work-phase" style={{color: PHASE_COLORS[t.phase]}}>
                                  {PHASE_LABELS[t.phase]}
                                </span>
                              )}
                              <span>{formatTime(startTs)}</span>
                              {t.completedAt && <span>→ {formatTime(t.completedAt)}</span>}
                              {t.completedAt && <span className="duration">({formatSpan(startTs, t.completedAt)})</span>}
                              {isRunning && <span className="running">Running {formatRunning(startTs)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedAgent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Toast Notifications --- */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => removeToast(toast.id)}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
