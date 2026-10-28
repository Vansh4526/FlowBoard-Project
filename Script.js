/* ═══════════════════════════════════════════
   DATA & STATE
═══════════════════════════════════════════ */
const COLS = ['todo','inprogress','review','done'];
const PRIO_WEIGHT = {critical:4, high:3, medium:2, low:1};

let tasks = JSON.parse(localStorage.getItem('flowboard_tasks') || 'null');
let dragId = null;
let searchQuery = '';

/* Seed with demo data on first load */
if (!tasks) {
  const today = new Date();
  const d = (n) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate()+n);
    return dt.toISOString().split('T')[0];
  };
  tasks = [
    {id:uid(),title:'Set up project repository and CI pipeline',desc:'Create GitHub repo, configure GitHub Actions for CI/CD.',priority:'high',urgency:4,impact:5,deadline:d(2),tags:['devops','setup'],column:'todo',created:Date.now()-5e5},
    {id:uid(),title:'Design wireframes for dashboard',desc:'Create low-fi wireframes in Figma for all main screens.',priority:'medium',urgency:3,impact:4,deadline:d(4),tags:['design','ux'],column:'todo',created:Date.now()-4e5},
    {id:uid(),title:'Fix critical login bug',desc:'Users are getting 401 errors intermittently on login.',priority:'critical',urgency:5,impact:5,deadline:d(0),tags:['bug','auth'],column:'inprogress',created:Date.now()-3e5},
    {id:uid(),title:'Implement REST API endpoints',desc:'Build CRUD endpoints for /tasks and /users.',priority:'high',urgency:4,impact:4,deadline:d(5),tags:['backend','api'],column:'inprogress',created:Date.now()-2e5},
    {id:uid(),title:'Write unit tests for core module',desc:'Aim for 80%+ coverage on the business logic layer.',priority:'medium',urgency:2,impact:4,deadline:d(8),tags:['testing'],column:'review',created:Date.now()-1e5},
    {id:uid(),title:'Update README documentation',desc:'Add setup instructions and API docs to README.',priority:'low',urgency:1,impact:2,deadline:d(14),tags:['docs'],column:'done',created:Date.now()-5e4},
    {id:uid(),title:'Code review for PR #42',desc:'Review pull request from teammate.',priority:'medium',urgency:3,impact:3,deadline:d(1),tags:['review'],column:'review',created:Date.now()-8e4},
  ];
}

function uid(){return '_'+Math.random().toString(36).slice(2,10)}
function save(){localStorage.setItem('flowboard_tasks',JSON.stringify(tasks))}

/* ═══════════════════════════════════════════
   PRIORITY SCORE ALGORITHM
   Score = (urgency × 0.4) + (impact × 0.4) + (priorityWeight × 0.2) × 25
   Boosted by deadline proximity (overdue = +30, ≤2d = +20, ≤5d = +10)
═══════════════════════════════════════════ */
function calcScore(task) {
  const base = (task.urgency * 0.4 + task.impact * 0.4 + PRIO_WEIGHT[task.priority] * 0.2) * 25;
  let boost = 0;
  if (task.deadline) {
    const diff = Math.ceil((new Date(task.deadline) - new Date()) / 86400000);
    if (diff < 0)      boost = 30;
    else if (diff <= 2) boost = 20;
    else if (diff <= 5) boost = 10;
  }
  return Math.min(100, Math.round(base + boost));
}

/* ═══════════════════════════════════════════
   MULTI-KEY SORT
═══════════════════════════════════════════ */
function sortTasks(arr) {
  const mode = document.getElementById('sort-select').value;
  return [...arr].sort((a,b) => {
    if (mode === 'score')    return calcScore(b) - calcScore(a);
    if (mode === 'deadline') {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (mode === 'title')   return a.title.localeCompare(b.title);
    if (mode === 'created') return b.created - a.created;
    return 0;
  });
}

/* ═══════════════════════════════════════════
   DEADLINE HELPER
═══════════════════════════════════════════ */
function deadlineInfo(dl) {
  if (!dl) return null;
  const diff = Math.ceil((new Date(dl) - new Date()) / 86400000);
  if (diff < 0)      return {label:`${Math.abs(diff)}d overdue`, cls:'deadline-overdue'};
  if (diff === 0)    return {label:'Due today',                   cls:'deadline-soon'};
  if (diff <= 3)     return {label:`${diff}d left`,               cls:'deadline-soon'};
  return              {label:`${diff}d left`,                     cls:'deadline-ok'};
}

/* ═══════════════════════════════════════════
   RENDER
═══════════════════════════════════════════ */
function renderAll() {
  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter(t => t.column === 'done').length;

  COLS.forEach(col => {
    let colTasks = tasks.filter(t => t.column === col);
    if (searchQuery) {
      colTasks = colTasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery) ||
        (t.desc||'').toLowerCase().includes(searchQuery) ||
        (t.tags||[]).some(tag => tag.includes(searchQuery))
      );
    }
    colTasks = sortTasks(colTasks);

    const area = document.getElementById('cards-'+col);
    area.innerHTML = '';

    if (colTasks.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>
        ${searchQuery ? 'No matches' : 'No tasks yet'}
      </div>`;
    } else {
      colTasks.forEach(task => area.appendChild(buildCard(task)));
    }

    document.getElementById('count-'+col).textContent = colTasks.length;
    const allColTasks = tasks.filter(t => t.column === col).length;
    const doneColTasks = col === 'done' ? allColTasks : 0;
    const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    document.getElementById('prog-'+col).style.width = pct + '%';
    document.getElementById('prog-'+col+'-label').textContent = `${doneTasks} of ${totalTasks} done (${pct}%)`;
  });

  document.getElementById('board-meta').textContent =
    `${totalTasks} task${totalTasks !== 1 ? 's' : ''} · ${doneTasks} completed · ${totalTasks - doneTasks} remaining`;
}

function buildCard(task) {
  const score = calcScore(task);
  const dl    = deadlineInfo(task.deadline);
  const prioMap = {critical:'🔴 Critical',high:'🟠 High',medium:'🟡 Medium',low:'🟢 Low'};

  const el = document.createElement('div');
  el.className = 'task-card' + (task.column === 'done' ? ' col-done-card' : '');
  el.draggable = true;
  el.dataset.id = task.id;

  const tagsHtml = (task.tags||[]).filter(Boolean)
    .map(t => `<span class="tag">${t.trim()}</span>`).join('');

  el.innerHTML = `
    <div class="card-top">
      <div class="card-tags">${tagsHtml}</div>
      <button class="card-delete" onclick="deleteTask('${task.id}')" title="Delete task">×</button>
    </div>
    <div class="card-title">${escHtml(task.title)}</div>
    <div class="card-footer">
      <span class="priority-badge prio-${task.priority}">${prioMap[task.priority]}</span>
      <span class="priority-score">Score: ${score}</span>
      ${dl ? `<span class="deadline-badge ${dl.cls}">📅 ${dl.label}</span>` : ''}
    </div>
  `;

  el.addEventListener('dragstart', e => {
    dragId = task.id;
    setTimeout(() => el.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragId = null;
    document.querySelectorAll('.cards-area').forEach(a => a.classList.remove('drag-active'));
    document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  });

  return el;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═══════════════════════════════════════════
   DRAG & DROP
═══════════════════════════════════════════ */
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget;
  col.classList.add('drag-over');
  const area = col.querySelector('.cards-area');
  if (area) area.classList.add('drag-active');
}
function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
    const area = e.currentTarget.querySelector('.cards-area');
    if (area) area.classList.remove('drag-active');
  }
}
function onDrop(e, col) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const area = e.currentTarget.querySelector('.cards-area');
  if (area) area.classList.remove('drag-active');
  if (!dragId) return;
  const task = tasks.find(t => t.id === dragId);
  if (task && task.column !== col) {
    task.column = col;
    save();
    renderAll();
    showToast(`Moved to "${col === 'inprogress' ? 'In Progress' : col.charAt(0).toUpperCase()+col.slice(1)}"`);
  }
}

/* ═══════════════════════════════════════════
   MODAL
═══════════════════════════════════════════ */
function openModal(col) {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('f-title').value = '';
  document.getElementById('f-desc').value  = '';
  document.getElementById('f-tags').value  = '';
  document.getElementById('f-priority').value = 'medium';
  document.getElementById('f-urgency').value  = '3';
  document.getElementById('f-impact').value   = '3';
  document.getElementById('f-deadline').value = '';
  document.getElementById('f-column').value = col || 'todo';
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}
function closeModalOnBackdrop(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

function addTask() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').focus(); showToast('Please enter a title!'); return; }
  const task = {
    id: uid(),
    title,
    desc:     document.getElementById('f-desc').value.trim(),
    priority: document.getElementById('f-priority').value,
    urgency:  +document.getElementById('f-urgency').value,
    impact:   +document.getElementById('f-impact').value,
    deadline: document.getElementById('f-deadline').value,
    tags:     document.getElementById('f-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    column:   document.getElementById('f-column').value,
    created:  Date.now()
  };
  tasks.unshift(task);
  save();
  renderAll();
  closeModal();
  showToast('Task created! Score: ' + calcScore(task));
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => t.id !== id);
  save();
  renderAll();
  showToast('Task deleted.');
}

/* ═══════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════ */
document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderAll();
});

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* Keyboard shortcut: N = new task */
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) openModal();
  if (e.key === 'Escape') closeModal();
});

/* Init */
renderAll();