let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

window.confirmWipe = () => {
    if (confirm("Wipe all data and reset system?")) {
        db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 });
        location.reload();
    }
};

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
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // Persistent Category List: Always pulled from the full products list
    const uniqueCats = [...new Set(products.map(p => p.cat || "").filter(Boolean))];
    const dl = document.getElementById('category-list');
    if(dl) dl.innerHTML = uniqueCats.map(c => `<option value="${c}">`).join('');

    const cats = ["All", ...uniqueCats];
    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = cats.map(c => `
            <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
        `).join('');
    }

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) && 
        (currentCat === "All" || (p.cat || "") === currentCat)
    ).sort((a,b) => b.fav - a.fav);

    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = filtered.map(p => `
            <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm transition-all" onclick="handleProductTap(${p.id})">
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                    <img src="${p.img || ''}" class="product-image">
                    ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
                </div>
                <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>
        `).join('');
    }

    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        inventoryList.innerHTML = products.map(p => `
            <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                    <img src="${p.img || ''}" class="w-full h-full object-cover">
                    <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
                </div>
                <div class="flex-1">
                    <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none">
                    <div class="flex items-center gap-2 mt-1">
                        <input type="text" list="category-list" value="${p.cat || ''}" onchange="editItem(${p.id}, 'cat', this.value)" placeholder="None" class="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md outline-none">
                        <span class="text-blue-600 font-black text-xs">$</span>
                        <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-xs outline-none">
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'} active:scale-125 transition-all"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                    <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>
        `).join('');
    }

    renderPendingAndHistory();
    lucide.createIcons();
}

function renderPendingAndHistory() {
    const pendingList = document.getElementById('pending-list');
    if(pendingList) {
        pendingList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
            <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
                <div class="bg-white px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-2 mb-3">
                    <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Order Tag..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    ${ord.items.map(i => `<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">${i.name} x${i.qty}</span>`).join('')}
                </div>
                <div class="flex gap-2">
                    <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Approve $${ord.total.toFixed(2)}</button>
                    <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-400 rounded-2xl"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>
        `).join('');
    }

    const historyList = document.getElementById('history-list');
    if(historyList) {
        historyList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
            <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3 shadow-sm" onclick="toggleOrderExpand(${idx})">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span>
                        <input type="text" value="${h.desc || ''}" onchange="event.stopPropagation(); updateTag('history', ${idx}, this.value)" class="font-bold text-slate-700 text-sm bg-transparent outline-none">
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
                        <button onclick="event.stopPropagation(); reorder(${idx})" class="p-2 bg-slate-50 rounded-xl text-slate-400 active:rotate-180 transition-all"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
                    </div>
                </div>
                <div class="order-detail">
                    <p class="text-[10px] text-slate-400 font-bold mb-3">${h.date}</p>
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${h.items.map(i => `<span class="bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-100">${i.name} x${i.qty}</span>`).join('')}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); editOrderDetails(${idx})" class="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px]">Edit Order</button>
                        <button onclick="event.stopPropagation(); removeItemFromList('history', ${idx})" class="px-4 py-3 bg-red-50 text-red-400 rounded-xl"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    if(topBadge) { topBadge.innerText = totalQty; topBadge.classList.toggle('hidden', totalQty === 0); }
}

window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.addItem = () => { products.unshift({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false, cat: '' }); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.setCategory = (cat) => { currentCat = cat; render(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(order);
    if(summaryEnabled) openSummary(order);
    cart = []; render(); pushData();
};

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
};

window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    const bO = document.getElementById('sub-btn-orders'), bS = document.getElementById('sub-btn-stock');
    bO.className = (sec === 'orders') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    bS.className = (sec === 'stock') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
};

window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.reorder = idx => { const item = history[idx]; orderCounter++; queue.unshift({ ...item, orderNum: orderCounter, date: new Date().toLocaleTimeString() }); pushData(); };
window.updateTag = (list, idx, val) => { if(list === 'queue') queue[idx].desc = val; else history[idx].desc = val; pushData(); };
window.removeItemFromList = (list, idx) => { if(list === 'queue') queue.splice(idx, 1); else history.splice(idx, 1); pushData(); };
window.toggleOrderExpand = idx => { document.getElementById(`hist-card-${idx}`).classList.toggle('order-expanded'); };
window.editOrderDetails = idx => { cart = JSON.parse(JSON.stringify(history[idx].items)); history.splice(idx, 1); window.showView('cashier'); pushData(); };

window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.executeExport = () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `TapMS_Backup.json`; a.click();
    closeBackupModal();
};
window.triggerImport = () => document.getElementById('db-import-input').click();
window.importDatabase = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { try { products = JSON.parse(ev.target.result); pushData(); alert("Restore Complete!"); closeBackupModal(); } catch { alert("Invalid File!"); } };
    reader.readAsText(e.target.files[0]);
};

window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('summary-toggle-ui').querySelector('span');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    label.innerText = summaryEnabled ? "Summary: ON" : "Summary: OFF";
    label.className = summaryEnabled ? "text-[10px] font-black uppercase text-blue-600" : "text-[10px] font-black uppercase text-slate-500";
};

function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-bold uppercase"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('');
    document.getElementById('summary-overlay').classList.add('active');
}
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };

initTapMS();
