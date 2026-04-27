let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let categories = ["All"];
let searchTerm = "", currentCat = "All", summaryEnabled = false;
let selectedIds = new Set(); 

async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        YOUR_UID = config.adminUid;
        firebase.initializeApp(config);
        db = firebase.database();
        auth = firebase.auth();
        auth.onAuthStateChanged(user => {
            if (user && user.uid === YOUR_UID) {
                document.getElementById('status-dot').className = "w-3 h-3 rounded-full dot-connected";
                startSync();
            } else {
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456").catch(e => console.error(e));
            }
        });
    } catch (e) { console.error(e); }
}

function startSync() {
    db.ref('/').on('value', snap => {
        const data = snap.val() || {};
        products = data.products || [];
        queue = data.queue || [];
        history = data.history || [];
        orderCounter = data.orderCounter || 0;
        categories = data.categories || ["All"];
        if (!categories.includes("All")) categories.unshift("All");
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter, categories }); }

function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // Render Categories Tabs
    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = categories.map(c => `
            <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase flex-shrink-0 transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
        `).join('');
    }

    // Render Cashier View
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm) && (currentCat === "All" || (p.cat || "") === currentCat)).sort((a,b) => b.fav - a.fav);
    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = filtered.map(p => {
            const qty = (cart.find(c => c.id === p.id) || {qty:0}).qty;
            return `
            <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm relative cursor-pointer" onclick="handleProductTap(event, ${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-10">${qty}</div>` : ''}
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 pointer-events-none">
                    <img src="${p.img || ''}" class="product-image" onerror="this.src='https://placehold.co/400x400?text=No+Image'">
                </div>
                <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>`;
        }).join('');
    }

    // Summary Toggle UI
    const sBtn = document.getElementById('summary-toggle-ui');
    const sDot = document.getElementById('toggle-dot');
    const sLabel = sBtn?.querySelector('span');
    if(sBtn && sDot) {
        if(summaryEnabled) {
            sBtn.className = "flex items-center gap-3 px-4 py-4 rounded-2xl border border-blue-200 bg-blue-50 shadow-sm flex-1";
            sDot.className = "w-2.5 h-2.5 rounded-full bg-blue-600 shadow-md";
            sLabel.innerText = "Summary: ON";
            sLabel.className = "text-[10px] font-black uppercase text-blue-600";
        } else {
            sBtn.className = "flex items-center gap-3 px-4 py-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex-1";
            sDot.className = "w-2.5 h-2.5 rounded-full bg-slate-300";
            sLabel.innerText = "Summary: OFF";
            sLabel.className = "text-[10px] font-black uppercase text-slate-500";
        }
    }

    // Bulk Bar Visibility
    const bBar = document.getElementById('bulk-bar');
    if(bBar) {
        bBar.classList.toggle('hidden', selectedIds.size === 0);
        document.getElementById('selected-count').innerText = `${selectedIds.size} SELECTED`;
    }

    // Inventory List
    const invList = document.getElementById('inventory-list');
    if(invList) {
        invList.innerHTML = products.map((p, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border ${selectedIds.has(p.id) ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100'} space-y-4">
                <div class="flex items-center gap-4">
                    <input type="checkbox" class="bulk-check" ${selectedIds.has(p.id) ? 'checked' : ''} onchange="toggleSelectProduct(${p.id})">
                    <div class="flex-1 min-w-0">
                        <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-extrabold text-sm bg-transparent outline-none truncate">
                        <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-24 font-black text-sm text-blue-600 bg-transparent outline-none">
                    </div>
                    <button onclick="removeItem(${p.id})" class="text-red-300 hover:text-red-500"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${categories.filter(c => c !== "All").map(c => `<button onclick="editItem(${p.id}, 'cat', '${c}')" class="px-3 py-1 rounded-xl text-[9px] font-black uppercase ${p.cat === c ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}">${c}</button>`).join('')}
                </div>
            </div>`).join('');
    }

    // Category Manager List
    const catManagerList = document.getElementById('category-manager-list');
    if(catManagerList) {
        catManagerList.innerHTML = categories.filter(c => c !== "All").map((c, i) => `
            <div class="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl">
                <input type="text" value="${c}" onchange="editCatName(${i+1}, this.value)" class="flex-1 bg-transparent font-bold text-xs outline-none">
                <button onclick="removeCat(${i+1})" class="text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`).join('');
    }

    renderPendingAndHistory();
    lucide.createIcons();
}

// --- LOGIC FUNCTIONS ---
window.toggleSummary = () => { summaryEnabled = !summaryEnabled; render(); };
window.importCSV = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const rows = text.split('\n').slice(1).filter(r => r.trim() !== '');
        const newItems = rows.map(r => {
            const [name, price, img, cat] = r.split(',').map(v => v.trim());
            return { id: Date.now() + Math.random(), name: name || 'New', price: parseFloat(price) || 0, img: img || '', fav: false, cat: cat || '' };
        });
        products = [...newItems, ...products]; pushData();
    };
    reader.readAsText(file); e.target.value = '';
};

window.toggleSelectProduct = (id) => { if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); render(); };
window.deleteSelected = () => { if(confirm("Delete selected?")) { products = products.filter(p => !selectedIds.has(p.id)); selectedIds.clear(); pushData(); } };

window.handleProductTap = (e, id) => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if(entry) entry.qty++; else cart.push({...p, qty:1}); render();
};

window.checkoutToQueue = () => {
    if(!cart.length) return; orderCounter++;
    const ord = { orderNum: orderCounter, items:[...cart], total: cart.reduce((s,i)=>s+(i.price*i.qty),0), date: new Date().toLocaleTimeString() };
    queue.unshift(ord); if(summaryEnabled) openSummary(ord); cart=[]; pushData();
};

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v === 'cashier') ? 'flex flex-col items-center gap-2 p-3 active-tab transition-all' : 'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
    document.getElementById('btn-manage').className = (v === 'manage') ? 'flex flex-col items-center gap-2 p-3 active-tab transition-all' : 'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
};

window.toggleManageSection = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('sub-btn-orders').className = (s === 'orders') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    document.getElementById('sub-btn-stock').className = (s === 'stock') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
};

// System Modals
window.openSummary = o => { document.getElementById('sum-id').innerText=`#${o.orderNum}`; document.getElementById('sum-total').innerText=`$${o.total.toFixed(2)}`; document.getElementById('summary-overlay').classList.add('active'); };
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.toggleCategoryManager = () => document.getElementById('category-manager-card').classList.toggle('manager-expanded');
window.toggleSearch = () => { document.getElementById('search-container').classList.toggle('hidden'); };

// Data Management
window.addItem = () => { products.unshift({id:Date.now(), name:'New Item', price:0, img:'', cat:''}); pushData(); };
window.removeItem = id => { products = products.filter(p=>p.id!==id); pushData(); };
window.addCat = () => { const n = prompt("Category Name:"); if(n) { categories.push(n); pushData(); } };
window.removeCat = i => { categories.splice(i,1); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x=>x.id===id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.setCategory = c => { currentCat = c; render(); };
window.filterProducts = v => { searchTerm = v.toLowerCase(); render(); };

function renderPendingAndHistory() {
    const pList = document.getElementById('pending-list');
    if(pList) pList.innerHTML = queue.map((o,i)=> `<div class="bg-white p-5 rounded-3xl border">#${o.orderNum} - $${o.total.toFixed(2)} <button onclick="approveOrder(${i})" class="ml-4 text-blue-600 font-bold">Approve</button></div>`).join('');
    const hList = document.getElementById('history-list');
    if(hList) hList.innerHTML = history.map(h => `<div class="p-3 text-xs">#${h.orderNum} - $${h.total.toFixed(2)}</div>`).join('');
}
window.approveOrder = i => { history.unshift(queue[i]); queue.splice(i,1); pushData(); };

initTapMS();
