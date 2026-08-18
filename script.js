(function(){
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('emptyState');
  const countBadge = document.getElementById('countBadge');
  const input = document.getElementById('ideaInput');
  const saveBtn = document.getElementById('saveBtn');
  const tagSelect = document.getElementById('tagSelect');
  const filters = document.getElementById('filters');
  const statusMsg = document.getElementById('statusMsg');
  const catManagerToggle = document.getElementById('catManagerToggle');
  const catManager = document.getElementById('catManager');
  const catList = document.getElementById('catList');
  const catInput = document.getElementById('catInput');
  const catAddBtn = document.getElementById('catAddBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');
  const authScreen = document.getElementById('authScreen');
  const authSubtitle = document.getElementById('authSubtitle');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authError = document.getElementById('authError');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const appRoot = document.getElementById('appRoot');
  const userEmailLabel = document.getElementById('userEmailLabel');
  const logoutBtn = document.getElementById('logoutBtn');

  const SUPABASE_URL = 'https://gaxptnxswpksbvfygmrw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_AFX2kJ2OYl6sNgObBrwPhg_-j6hkAYm';
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let authMode = 'signin';
  let currentUser = null;
  const DEFAULT_CATEGORIES = ['General','Maratón','Contenido','Reflexión'];

  let categories = [...DEFAULT_CATEGORIES];
  let ideas = [];
  let currentTag = categories[0];
  let currentFilter = 'Todas';
  let nextBib = 1;
  let pendingDeleteId = null;
  let editingId = null;

  async function loadFromCloud(){
    statusMsg.textContent = 'Cargando tus ideas...';
    try{
      const { data, error } = await sb
        .from('bitacora_data')
        .select('data')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if(error) throw error;

      if(data && data.data){
        const d = data.data;
        categories = (Array.isArray(d.categories) && d.categories.length) ? d.categories : [...DEFAULT_CATEGORIES];
        ideas = Array.isArray(d.ideas) ? d.ideas.map(i => ({ ...i, status: i.status || 'pendiente' })) : [];
      } else {
        categories = [...DEFAULT_CATEGORIES];
        ideas = [];
        await persist();
      }
      currentTag = categories[0];
      nextBib = ideas.reduce((max,i)=>Math.max(max,i.bib||0),0) + 1;
      statusMsg.textContent = '';
    }catch(e){
      statusMsg.textContent = 'No se pudieron cargar tus datos. Revisa tu conexión.';
    }
  }

  async function persist(){
    if(!currentUser) return;
    try{
      const { error } = await sb.from('bitacora_data').upsert({
        user_id: currentUser.id,
        data: { categories, ideas },
        updated_at: new Date().toISOString()
      });
      if(error) throw error;
      statusMsg.textContent = '';
    }catch(e){
      statusMsg.textContent = 'No se pudo guardar en la nube.';
    }
  }

  function setAuthMode(mode){
    authMode = mode;
    authError.textContent = '';
    authError.className = 'auth-error';
    if(mode === 'signin'){
      authSubtitle.textContent = 'Inicia sesión para ver tus ideas en cualquier dispositivo';
      authSubmitBtn.textContent = 'Iniciar sesión';
      authToggleBtn.textContent = '¿No tienes cuenta? Crear una';
    } else {
      authSubtitle.textContent = 'Crea tu cuenta para empezar a guardar en la nube';
      authSubmitBtn.textContent = 'Crear cuenta';
      authToggleBtn.textContent = '¿Ya tienes cuenta? Iniciar sesión';
    }
  }

  async function handleAuthSubmit(){
    const email = authEmail.value.trim();
    const password = authPassword.value;
    authError.className = 'auth-error';
    if(!email || !password){
      authError.textContent = 'Escribe tu correo y contraseña.';
      return;
    }
    if(authMode === 'signup' && password.length < 6){
      authError.textContent = 'La contraseña necesita al menos 6 caracteres.';
      return;
    }
    authSubmitBtn.disabled = true;
    authError.textContent = '';
    try{
      if(authMode === 'signin'){
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if(error) throw error;
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if(error) throw error;
        if(!data.session){
          authError.className = 'auth-error info';
          authError.textContent = 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.';
          setAuthMode('signin');
        }
      }
    }catch(e){
      authError.textContent = e.message && e.message.includes('already registered')
        ? 'Ese correo ya tiene cuenta, inicia sesión.'
        : (e.message || 'No se pudo completar la operación.');
    }
    authSubmitBtn.disabled = false;
  }

  function showAuthScreen(){
    authScreen.style.display = 'flex';
    appRoot.style.display = 'none';
  }

  async function onLogin(user){
    currentUser = user;
    authScreen.style.display = 'none';
    appRoot.style.display = 'block';
    userEmailLabel.textContent = user.email;
    await loadFromCloud();
    renderTagSelect();
    renderFilters();
    renderCatList();
    renderList();
  }

  function onLogout(){
    currentUser = null;
    categories = [...DEFAULT_CATEGORIES];
    ideas = [];
    authEmail.value = '';
    authPassword.value = '';
    setAuthMode('signin');
    showAuthScreen();
  }

  async function initAuth(){
    const { data: { session } } = await sb.auth.getSession();
    if(session){
      await onLogin(session.user);
    } else {
      showAuthScreen();
    }
    sb.auth.onAuthStateChange((event, session)=>{
      if(session && (!currentUser || currentUser.id !== session.user.id)){
        onLogin(session.user);
      } else if(!session && currentUser){
        onLogout();
      }
    });
  }

  authSubmitBtn.addEventListener('click', handleAuthSubmit);
  authToggleBtn.addEventListener('click', ()=>setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  authPassword.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') handleAuthSubmit(); });
  logoutBtn.addEventListener('click', ()=>sb.auth.signOut());

  function pad(n){ return String(n).padStart(3,'0'); }

  function formatDate(ts){
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
  }

  function renderTagSelect(){
    tagSelect.innerHTML = '';
    categories.forEach(cat=>{
      const btn = document.createElement('button');
      btn.className = 'tag-chip' + (cat === currentTag ? ' active' : '');
      btn.textContent = cat;
      btn.dataset.tag = cat;
      btn.addEventListener('click', ()=>{
        currentTag = cat;
        renderTagSelect();
      });
      tagSelect.appendChild(btn);
    });
  }

  function renderFilters(){
    filters.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn' + (currentFilter === 'Todas' ? ' active' : '');
    allBtn.textContent = 'Todas';
    allBtn.addEventListener('click', ()=>{ currentFilter = 'Todas'; renderFilters(); renderList(); });
    filters.appendChild(allBtn);

    categories.forEach(cat=>{
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (currentFilter === cat ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', ()=>{ currentFilter = cat; renderFilters(); renderList(); });
      filters.appendChild(btn);
    });

    const completeBtn = document.createElement('button');
    completeBtn.className = 'filter-btn realizadas' + (currentFilter === 'Realizadas' ? ' active' : '');
    completeBtn.textContent = 'Realizadas';
    completeBtn.addEventListener('click', ()=>{ currentFilter = 'Realizadas'; renderFilters(); renderList(); });
    filters.appendChild(completeBtn);

    const archiveBtn = document.createElement('button');
    archiveBtn.className = 'filter-btn archivadas' + (currentFilter === 'Archivadas' ? ' active' : '');
    archiveBtn.textContent = 'Archivadas';
    archiveBtn.addEventListener('click', ()=>{ currentFilter = 'Archivadas'; renderFilters(); renderList(); });
    filters.appendChild(archiveBtn);
  }

  function renderCatList(){
    catList.innerHTML = '';
    categories.forEach(cat=>{
      const pill = document.createElement('div');
      pill.className = 'cat-pill';
      const label = document.createElement('span');
      label.textContent = cat;
      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = 'Eliminar categoría';
      delBtn.addEventListener('click', ()=>deleteCategory(cat));
      pill.appendChild(label);
      pill.appendChild(delBtn);
      catList.appendChild(pill);
    });
  }

  function deleteCategory(cat){
    if(categories.length <= 1){
      statusMsg.textContent = 'Necesitas al menos una categoría.';
      return;
    }
    categories = categories.filter(c=>c!==cat);
    const fallback = categories[0];
    ideas.forEach(idea=>{
      if(idea.tag === cat) idea.tag = fallback;
    });
    if(currentTag === cat) currentTag = fallback;
    if(currentFilter === cat) currentFilter = 'Todas';
    renderTagSelect();
    renderFilters();
    renderCatList();
    renderList();
    persist();
  }

  function addCategory(){
    const name = catInput.value.trim();
    if(!name) return;
    if(categories.some(c=>c.toLowerCase() === name.toLowerCase())){
      statusMsg.textContent = 'Esa categoría ya existe.';
      return;
    }
    categories.push(name);
    catInput.value = '';
    renderTagSelect();
    renderFilters();
    renderCatList();
    persist();
  }

  function renderList(){
    let filtered;
    if(currentFilter === 'Todas'){
      filtered = ideas.filter(i=>i.status !== 'archivada' && i.status !== 'realizada');
    } else if(currentFilter === 'Realizadas'){
      filtered = ideas.filter(i=>i.status === 'realizada');
    } else if(currentFilter === 'Archivadas'){
      filtered = ideas.filter(i=>i.status === 'archivada');
    } else {
      filtered = ideas.filter(i=>i.tag === currentFilter && i.status !== 'archivada' && i.status !== 'realizada');
    }
    const sorted = [...filtered].sort((a,b)=>b.createdAt-a.createdAt);

    countBadge.textContent = ideas.length + (ideas.length===1 ? ' IDEA' : ' IDEAS');

    listEl.innerHTML = '';
    if(sorted.length === 0){
      emptyEl.style.display = 'block';
      const emptyCopy = {
        'Realizadas': ['Nada realizado todavía', 'Cuando marques una idea como realizada, aparecerá aquí.'],
        'Archivadas': ['Nada archivado todavía', 'Cuando archives una idea activa, aparecerá aquí.']
      };
      const [bigMsg, smallMsg] = emptyCopy[currentFilter] || ['Aún no hay nada aquí', 'Escribe la primera idea arriba, aunque sea una palabra suelta.'];
      emptyEl.querySelector('.big').textContent = bigMsg;
      emptyEl.querySelector('.small').textContent = smallMsg;
      return;
    }
    emptyEl.style.display = 'none';

    sorted.forEach(idea=>{
      const card = document.createElement('div');
      card.className = 'idea-card ' + idea.status;

      const top = document.createElement('div');
      top.className = 'idea-top';

      const meta = document.createElement('div');
      meta.className = 'idea-meta';
      meta.innerHTML = `<span class="bib">#${pad(idea.bib)}</span>
        <span class="idea-tag">${idea.tag}</span>
        ${idea.status === 'en_proceso' ? '<span class="idea-status-badge">En proceso</span>' : ''}
        <span class="idea-date">${formatDate(idea.createdAt)}</span>`;

      const actions = document.createElement('div');
      actions.className = 'idea-actions';

      if(idea.status !== 'archivada' && idea.status !== 'realizada'){
        const progressBtn = document.createElement('button');
        progressBtn.className = 'action-btn progress' + (idea.status === 'en_proceso' ? ' active' : '');
        progressBtn.textContent = idea.status === 'en_proceso' ? 'En proceso' : 'Marcar en proceso';
        progressBtn.addEventListener('click', ()=>toggleProgress(idea.id));
        actions.appendChild(progressBtn);

        const completeBtn = document.createElement('button');
        completeBtn.className = 'action-btn complete';
        completeBtn.textContent = 'Realizar';
        completeBtn.title = 'Enviar a Realizadas';
        completeBtn.addEventListener('click', ()=>completeIdea(idea.id));
        actions.appendChild(completeBtn);

        const archiveBtn = document.createElement('button');
        archiveBtn.className = 'action-btn archive';
        archiveBtn.textContent = 'Archivar';
        archiveBtn.title = 'Enviar a Archivadas';
        archiveBtn.addEventListener('click', ()=>archiveIdea(idea.id));
        actions.appendChild(archiveBtn);
      } else {
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'action-btn restore';
        restoreBtn.textContent = 'Restaurar';
        restoreBtn.addEventListener('click', ()=>restoreIdea(idea.id));
        actions.appendChild(restoreBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.title = 'Editar texto';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', ()=>startEdit(idea.id));
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn';
      delBtn.title = 'Eliminar definitivamente';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', ()=>requestDeleteIdea(idea.id));
      actions.appendChild(delBtn);

      top.appendChild(meta);
      top.appendChild(actions);
      card.appendChild(top);

      if(editingId === idea.id){
        const editArea = document.createElement('textarea');
        editArea.className = 'idea-edit-area';
        editArea.value = idea.text;

        const editActions = document.createElement('div');
        editActions.className = 'idea-edit-actions';

        const cancelEditBtn = document.createElement('button');
        cancelEditBtn.className = 'action-btn';
        cancelEditBtn.textContent = 'Cancelar';
        cancelEditBtn.addEventListener('click', ()=>{ editingId = null; renderList(); });

        const saveEditBtn = document.createElement('button');
        saveEditBtn.className = 'action-btn edit';
        saveEditBtn.textContent = 'Guardar cambios';
        saveEditBtn.addEventListener('click', ()=>saveEdit(idea.id, editArea.value));

        editActions.appendChild(cancelEditBtn);
        editActions.appendChild(saveEditBtn);

        card.appendChild(editArea);
        card.appendChild(editActions);
        listEl.appendChild(card);
        editArea.focus();
        editArea.setSelectionRange(editArea.value.length, editArea.value.length);
        return;
      }

      const text = document.createElement('div');
      text.className = 'idea-text';
      text.textContent = idea.text;
      card.appendChild(text);
      listEl.appendChild(card);
    });
  }

  function addIdea(){
    const text = input.value.trim();
    if(!text) return;
    const idea = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
      bib: nextBib++,
      tag: currentTag,
      text: text,
      status: 'pendiente',
      createdAt: Date.now()
    };
    ideas.push(idea);
    input.value = '';
    renderList();
    persist();
  }

  function toggleProgress(id){
    const idea = ideas.find(i=>i.id===id);
    if(idea){
      idea.status = idea.status === 'en_proceso' ? 'pendiente' : 'en_proceso';
      renderList();
      persist();
    }
  }

  function completeIdea(id){
    const idea = ideas.find(i=>i.id===id);
    if(idea){
      idea.status = 'realizada';
      renderList();
      persist();
    }
  }

  function archiveIdea(id){
    const idea = ideas.find(i=>i.id===id);
    if(idea){
      idea.status = 'archivada';
      renderList();
      persist();
    }
  }

  function startEdit(id){
    editingId = id;
    renderList();
  }

  function saveEdit(id, newText){
    const trimmed = newText.trim();
    if(!trimmed){
      statusMsg.textContent = 'La idea no puede quedar vacía.';
      return;
    }
    const idea = ideas.find(i=>i.id===id);
    if(idea){
      idea.text = trimmed;
    }
    editingId = null;
    renderList();
    persist();
  }

  function restoreIdea(id){
    const idea = ideas.find(i=>i.id===id);
    if(idea){
      idea.status = 'pendiente';
      renderList();
      persist();
    }
  }

  function deleteIdea(id){
    ideas = ideas.filter(i=>i.id!==id);
    renderList();
    persist();
  }

  function requestDeleteIdea(id){
    pendingDeleteId = id;
    modalOverlay.classList.add('open');
    modalConfirmBtn.focus();
  }

  function closeModal(){
    modalOverlay.classList.remove('open');
    pendingDeleteId = null;
  }

  modalCancelBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e)=>{
    if(e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
  });
  modalConfirmBtn.addEventListener('click', ()=>{
    if(pendingDeleteId){ deleteIdea(pendingDeleteId); }
    closeModal();
  });

  saveBtn.addEventListener('click', addIdea);
  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){
      addIdea();
    }
  });

  catManagerToggle.addEventListener('click', ()=>{
    const isOpen = catManager.classList.toggle('open');
    catManagerToggle.textContent = isOpen ? '− ocultar categorías' : '+ editar categorías';
  });
  catAddBtn.addEventListener('click', addCategory);
  catInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') addCategory();
  });

  initAuth();
})();