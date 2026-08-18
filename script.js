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

  const STORAGE_KEY = 'bitacora-de-ideas:data';
  const DEFAULT_CATEGORIES = ['General','Negocios','Personal','Otros'];

  let categories = [...DEFAULT_CATEGORIES];
  let ideas = [];
  let currentTag = categories[0];
  let currentFilter = 'Todas';
  let nextBib = 1;
  let pendingDeleteId = null;

  function pad(n){ return String(n).padStart(3,'0'); }

  function formatDate(ts){
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const data = JSON.parse(raw);
        if(Array.isArray(data.categories) && data.categories.length){
          categories = data.categories;
        }
        if(Array.isArray(data.ideas)){
          ideas = data.ideas.map(i => {
            let status = i.status || (i.done ? 'archivada' : 'pendiente');
            return { ...i, status };
          });
        }
      }
    }catch(e){
      categories = [...DEFAULT_CATEGORIES];
      ideas = [];
    }
    currentTag = categories[0];
    nextBib = ideas.reduce((max,i)=>Math.max(max,i.bib||0),0) + 1;
  }

  function persist(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, ideas }));
      statusMsg.textContent = '';
    }catch(e){
      statusMsg.textContent = 'No se pudo guardar en este navegador.';
    }
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

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn';
      delBtn.title = 'Eliminar definitivamente';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', ()=>requestDeleteIdea(idea.id));
      actions.appendChild(delBtn);

      top.appendChild(meta);
      top.appendChild(actions);

      const text = document.createElement('div');
      text.className = 'idea-text';
      text.textContent = idea.text;

      card.appendChild(top);
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

  load();
  renderTagSelect();
  renderFilters();
  renderCatList();
  renderList();
})();
