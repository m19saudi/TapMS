let YOUR_UID = "";
let db, auth, resetTimer;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

function promptWipe() { if(confirm("Wipe all data?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } }
function startReset() { resetTimer = setTimeout(() => { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); }, 1000); }
function stopReset() { clearTimeout(resetTimer); }

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
                document.getElementById('status-dot').className = "w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
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

window.setCat = (c) => { currentCat = c; render(); };

window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('summary-toggle-ui').querySelector('span');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    label.innerText = summaryEnabled ? "Summary: ON" : "Summary: OFF";
    label.className = summaryEnabled ? "text-[10px] font-black uppercase text-blue-600 tracking-widest" : "text-[10px] font-black uppercase text-slate-500 tracking-widest";
};

function render() {
    const navb = document.getElementById('nav-badge');
    const ordn = document.getElementById('order-notif');
    const hasQueue = queue.length > 0;
    if(navb) navb.classList.toggle('hidden', !hasQueue);
    if(ordn) ordn.classList.toggle('hidden', !hasQueue);

    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCat('${c}')" class="px-6 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    const filtered = products.filter(p => (currentCat === "All" || (p.category || "General") === currentCat) && p.name.toLowerCase().includes(searchTerm)).sort((a,b) => b.fav - a.fav);
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="item-card bg-white p-5 rounded-[3rem] border border-slate-100 shadow-sm" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-4 overflow-hidden rounded-[2.2rem] bg-slate-50 relative pointer-events-none">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-3 right-3 text-amber-500"><i data-lucide="star" class="w-5 h-5 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-sm truncate px-1 uppercase tracking-tight pointer-events-none">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1 pointer-events-none">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock View - RECENTLY ADDED AT TOP
    const stockList = [...products].sort((a, b) => b.id - a.id);
    document.getElementById('inventory-list').innerHTML = stockList.map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div class="relative w-16 h-16 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
            </div>
            <div class="flex-1 overflow-hidden">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-base bg-transparent outline-none uppercase tracking-tight">
                <div class="flex items-center gap-2 mt-2">
                    <input type="text" placeholder="New Cat..." value="${p.category || ''}" onchange="editItem(${p.id}, 'category', this.value)" class="text-[10px] font-black text-blue-600 bg-slate-50 px-2 py-1 rounded-lg outline-none uppercase w-24">
                    <div class="flex gap-1 overflow-x-auto no-scrollbar py-1">
                        ${cats.filter(c => c !== "All" && c !== p.category).map(c => `
                            <button onclick="editItem(${p.id}, 'category', '${c}')" class="shrink-0 text-[8px] font-bold bg-white text-slate-400 px-2 py-1 rounded-lg border border-slate-100 uppercase hover:text-blue-500">${c}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <span class="text-blue-600 font-black text-sm">$</span>
                    <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-20 font-black text-sm outline-none">
                </div>
            </div>
            <div class="flex flex-col gap-3">
                <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-6 h-6 fill-current"></i></button>
                <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-500"><i data-lucide="trash-2" class="w-6 h-6"></i></button>
            </div>
        </div>
    `).join('');

    renderManageLists();
    updateCartCount();
    lucide.createIcons();
}

window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    updateCartCount();
};

function updateCartCount() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const badge = document.getElementById('cart-count-top');
    if(badge) { badge.innerText = totalQty; badge.classList.toggle('hidden', totalQty === 0); }
}

window.checkoutToQueue = () => {
    if(!cart.length) return;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    orderCounter++;
    const newOrder = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(newOrder);
    if (summaryEnabled) {
        openSummary(newOrder);
    } else {
        cart = []; render(); pushData();
    }
};

function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `
        <div class="flex justify-between items-center">
            <span class="font-bold text-xs uppercase text-slate-600">${i.name} <span class="text-slate-400">x${i.qty}</span></span>
            <span class="font-black text-xs text-slate-400">$${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');
    document.getElementById('summary-overlay').classList.add('active');
    cart = []; render(); pushData();
}

window.closeSummary = () => { document.getElementById('summary-overlay').classList.remove('active'); };

function renderManageLists() {
    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-xl px-4 mb-4 uppercase">Pending Approval</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-6 rounded-[3rem] border-2 border-blue-100 mb-4">
            <div class="bg-white px-4 py-3 rounded-2xl border border-blue-100 flex items-center gap-3 mb-4">
                <span class="text-blue-600 font-black text-xs">#${ord.orderNum}</span>
                <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Add Tag..." class="bg-transparent font-bold text-blue-700 text-sm outline-none w-full uppercase">
            </div>
            <div class="space-y-1 mb-6 px-2">${ord.items.map(i => `<div class="text-[11px] font-bold text-slate-500 uppercase">${i.name} x${i.qty}</div>`).join('')}</div>
            <div class="flex gap-3">
                <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-[1.8rem] font-black uppercase text-[11px] tracking-widest shadow-lg">Approve $${ord.total.toFixed(2)}</button>
                <button onclick="removeItemFromList('queue', ${idx})" class="px-6 bg-white border border-red-100 text-red-400 rounded-[1.8rem]"><i data-lucide="trash-2" class="w-6 h-6"></i></button>
            </div>
        </div>
    `).join('');

    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-xl px-4 mb-4 text-slate-400 uppercase">Archive</h2>` + history.map((h, idx) => `
        <div id="hist-card-${idx}" class="bg-white p-6 rounded-[3rem] border border-slate-100 mb-4 shadow-sm" onclick="toggleOrderExpand(${idx})">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <span class="text-slate-400 font-black text-xs">#${h.orderNum}</span>
                    <input type="text" value="${h.desc || ''}" onchange="event.stopPropagation(); updateTag('history', ${idx}, this.value)" class="font-bold text-slate-800 text-sm bg-transparent outline-none uppercase">
                </div>
                <p class="font-black text-blue-600 text-base">$${h.total.toFixed(2)}</p>
            </div>
            <div class="order-detail">
                <p class="text-[10px] text-slate-400 font-black mb-4 uppercase tracking-widest">${h.date}</p>
                <div class="space-y-1 mb-6 px-2">${h.items.map(i => `<div class="text-[11px] font-bold text-slate-400 uppercase">${i.name} x${i.qty}</div>`).join('')}</div>
                <div class="flex gap-3">
                    <button onclick="event.stopPropagation(); editOrderDetails(${idx})" class="flex-1 bg-slate-900 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest">Re-Open</button>
                    <button onclick="event.stopPropagation(); removeItemFromList('history', ${idx})" class="px-6 py-4 bg-red-50 text-red-400 rounded-[1.5rem]"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 active-tab p-5 transition-all':'flex flex-col items-center gap-2 text-slate-400 p-5 transition-all';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 active-tab p-5 transition-all':'flex flex-col items-center gap-2 text-slate-400 p-5 transition-all';
    lucide.createIcons();
};

window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.updateTag = (list, idx, val) => { if(list === 'queue') queue[idx].desc = val; else history[idx].desc = val; pushData(); };
window.toggleOrderExpand = idx => { document.getElementById(`hist-card-${idx}`).classList.toggle('order-expanded'); };
window.editOrderDetails = idx => { cart = JSON.parse(JSON.stringify(history[idx].items)); history.splice(idx, 1); window.showView('cashier'); pushData(); };
window.toggleManageSection = sec => { document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders'); document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock'); document.getElementById('sub-btn-orders').className = sec === 'orders' ? "relative px-12 py-3.5 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-12 py-3.5 rounded-xl text-xs font-black uppercase text-slate-500"; document.getElementById('sub-btn-stock').className = sec === 'stock' ? "relative px-12 py-3.5 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-12 py-3.5 rounded-xl text-xs font-black uppercase text-slate-500"; };
window.removeItemFromList = (list, idx) => { if(list === 'queue') queue.splice(idx, 1); else history.splice(idx, 1); pushData(); };
window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Product', price: 0, img: '', fav: false, category: 'General' }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };

initTapMS();
