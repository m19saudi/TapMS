let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let categories = ["All"];
let searchTerm = "", currentCat = "All", summaryEnabled = false;
let selectedItems = new Set();

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
    
    // Category Bar Rendering
    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = categories.map(c => `
            <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase flex-shrink-0 transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
        `).join('');
    }

    // Cashier View Rendering
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm) && (currentCat === "All" || (p.cat || "") === currentCat)).sort((a,b) => b.fav - a.fav);
    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = filtered.map(p => {
            const qty = (cart.find(c => c.id === p.id) || {qty:0}).qty;
            return `
            <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm relative select-none cursor-pointer" onclick="handleProductTap(event, ${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-10">${qty}</div>` : ''}
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                    <img src="${p.img || ''}" class="product-image">
                    ${p.fav ? '<div class="absolute top-2 left-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
                </div>
                <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>`;
        }).join('');
    }

    // Inventory List Rendering (Multi-Select & Reorder Handle)
    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        inventoryList.innerHTML = products.map((p, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 space-y-4 shadow-sm relative">
                <input type="checkbox" class="bulk-checkbox absolute top-4 right-4" onchange="toggleProductSelection(${p.id})" ${selectedItems.has(p.id) ? 'checked' : ''}>
                <div class="flex items-center gap-4">
                    <div class="flex flex-col gap-1">
                        <button onclick="moveItem(${idx}, -1)" class="p-1.5 bg-slate-50 rounded-lg text-slate-400"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>
                        <button onclick="moveItem(${idx}, 1)" class="p-1.5 bg-slate-50 rounded-lg text-slate-400"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>
                    </div>
                    <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                        <img src="${p.img || ''}" class="w-full h-full object-cover">
                        <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold" placeholder="URL">
                    </div>
                    <div class="flex-1 min-w-0">
                        <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-extrabold text-sm bg-transparent outline-none truncate block">
                        <div class="flex items-center mt-1"><span class="text-blue-600 font-black text-[11px] mr-1">$</span><input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-24 font-black text-sm bg-transparent outline-none text-blue-600"></div>
                    </div>
                    <div class="flex items-center gap-2 mr-8">
                        <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${categories.filter(c => c !== "All").map(c => `<button onclick="editItem(${p.id}, 'cat', '${c}')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${p.cat === c ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}">${c}</button>`).join('')}
                </div>
            </div>`).join('');
    }

    renderPendingAndHistory();
    updateBulkBar();
    lucide.createIcons();
}

// --- HISTORY & PENDING ---
function renderPendingAndHistory() {
    const pList = document.getElementById('pending-list');
    if(pList) {
        pList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
            <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100 mb-3">
                <div class="bg-white px-3 py-2 rounded-xl flex items-center gap-2 mb-3">
                    <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Tag..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    ${ord.items.map(i => `
                        <div class="item-tag-hover bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-blue-200">
                            ${i.name} x${i.qty}
                            <div class="item-preview-popup"><img src="${i.img}" class="w-full h-full object-cover rounded-lg"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-2">
                    <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve $${ord.total.toFixed(2)}</button>
                    <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-400 rounded-2xl transition-all"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>`).join('');
    }

    const hList = document.getElementById('history-list');
    if(hList) {
        hList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
            <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3 cursor-pointer shadow-sm overflow-hidden" onclick="toggleOrderExpand(${idx})">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span>
                        <input type="text" value="${h.desc || ''}" onclick="event.stopPropagation();" onchange="updateTag('history', ${idx}, this.value)" class="font-bold text-slate-700 text-sm bg-transparent outline-none">
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
                        <button onclick="event.stopPropagation(); reorder(${idx})" class="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-300 rotate-icon"></i>
                    </div>
                </div>
                <div class="manager-content">
                    <p class="text-[10px] text-slate-400 font-bold mb-3 mt-2">${h.date || ''}</p>
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${h.items.map(i => `
                            <div class="item-tag-hover bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-100">
                                ${i.name} x${i.qty}
                                <div class="item-preview-popup"><img src="${i.img}" class="w-full h-full object-cover rounded-lg"></div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); editOrderDetails(${idx})" class="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px]">Edit Order</button>
                        <button onclick="event.stopPropagation(); removeItemFromList('history', ${idx})" class="px-4 py-3 bg-red-50 text-red-400 rounded-xl"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            </div>`).join('');
    }
}

// --- ACTIONS & TOOLS ---
window.toggleOrderExpand = idx => document.getElementById(`hist-card-${idx}`).classList.toggle('manager-expanded');

window.toggleProductSelection = (id) => {
    if (selectedItems.has(id)) selectedItems.delete(id);
    else selectedItems.add(id);
    updateBulkBar();
};

function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if(bar) {
        bar.classList.toggle('hidden', selectedItems.size === 0);
        document.getElementById('selected-count').innerText = `${selectedItems.size} Items Selected`;
    }
}

window.deleteSelected = () => {
    if (confirm(`Delete ${selectedItems.size} products?`)) {
        products = products.filter(p => !selectedItems.has(p.id));
        selectedItems.clear();
        pushData();
    }
};

window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const btn = document.getElementById('summary-toggle-ui');
    const dot = document.getElementById('toggle-dot');
    btn.querySelector('span').innerText = `Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
    btn.querySelector('span').className = `text-[10px] font-black uppercase ${summaryEnabled ? 'text-blue-600' : 'text-slate-500'}`;
    dot.className = `w-2.5 h-2.5 rounded-full ${summaryEnabled ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-slate-300'}`;
};

window.confirmWipe = () => {
    if (confirm("🚨 WIPE ALL DATA? This cannot be undone.")) {
        products = []; queue = []; history = []; categories = ["All"]; orderCounter = 0;
        pushData(); closeBackupModal();
    }
};

window.resetOnlyOrders = () => {
    if (confirm("Clear all orders? Products will stay.")) {
        queue = []; history = []; orderCounter = 0;
        pushData(); closeBackupModal();
    }
};

window.importCSV = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const lines = ev.target.result.split('\n').slice(1);
        lines.forEach(line => {
            const [name, price, img, cat] = line.split(',');
            if (name) products.push({ id: Date.now() + Math.random(), name: name.trim(), price: parseFloat(price) || 0, img: (img||'').trim(), cat: (cat||'').trim(), fav: false });
        });
        pushData(); alert("CSV Imported!");
    };
    reader.readAsText(e.target.files[0]);
};

// --- CORE LOGIC (Cart/Move/Edit) ---
window.handleProductTap = (e, id) => {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.moveItem = (idx, step) => {
    const nIdx = idx + step;
    if (nIdx < 0 || nIdx >= products.length) return;
    [products[idx], products[nIdx]] = [products[nIdx], products[idx]];
    pushData();
};

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const ord = { orderNum: orderCounter, items: [...cart], total: cart.reduce((s, i) => s + (i.price * i.qty), 0), desc: "", date: new Date().toLocaleString() };
    queue.unshift(ord);
    if(summaryEnabled) openSummary(ord);
    cart = []; pushData();
};

function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-bold"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('');
    document.getElementById('summary-overlay').classList.add('active');
}

// Boilerplate helpers
window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
};
window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    document.getElementById('sub-btn-orders').className = (sec === 'orders') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    document.getElementById('sub-btn-stock').className = (sec === 'stock') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
};
window.toggleCategoryManager = () => document.getElementById('category-manager-card').classList.toggle('manager-expanded');
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.setCategory = (cat) => { currentCat = cat; render(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };
window.addItem = () => { products.unshift({ id: Date.now(), name: 'New Product', price: 0, img: '', fav: false, cat: '' }); pushData(); };
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };
window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.reorder = idx => { orderCounter++; queue.unshift({ ...history[idx], orderNum: orderCounter, date: new Date().toLocaleTimeString() }); pushData(); };
window.removeItemFromList = (l, i) => { if(l === 'queue') queue.splice(i, 1); else history.splice(i, 1); pushData(); };
window.updateTag = (l, i, v) => { if(l === 'queue') queue[i].desc = v; else history[i].desc = v; pushData(); };
window.editOrderDetails = idx => { cart = JSON.parse(JSON.stringify(history[idx].items)); history.splice(idx, 1); window.showView('cashier'); render(); };
window.executeExport = () => { const b = new Blob([JSON.stringify({products, categories}, null, 2)], { type: "application/json" }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup.json`; a.click(); closeBackupModal(); };

initTapMS();
