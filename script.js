let YOUR_UID = "";
let db, auth, resetTimer;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "";
let summaryEnabled = false; // NEW: Persistent toggle state

// 1 SECOND RESET LOGIC - PRESERVED AS REQUESTED
function startReset() {
    resetTimer = setTimeout(() => {
        if (confirm("Wipe all data and reset system?")) {
            db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 });
            location.reload();
        }
    }, 1000); 
}

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
        // Keep the toggle state if you decide to sync it to DB later, 
        // otherwise it stays local for the session.
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

// NEW: SUMMARY TOGGLE FUNCTION
window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('summary-toggle-ui').querySelector('span');
    
    if(summaryEnabled) {
        dot.className = "w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]";
        label.innerText = "Summary: ON";
        label.classList.replace('text-slate-500', 'text-blue-600');
    } else {
        dot.className = "w-2 h-2 rounded-full bg-slate-300";
        label.innerText = "Summary: OFF";
        label.classList.replace('text-blue-600', 'text-slate-500');
    }
};

// UPDATED CHECKOUT LOGIC
window.checkoutToQueue = () => {
    if(!cart.length) return;
    
    const checkoutAction = () => {
        orderCounter++;
        const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        queue.unshift({ orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() });
        cart = []; 
        render(); 
        pushData();
    };

    if (summaryEnabled) {
        const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const itemNames = cart.map(i => `${i.name} x${i.qty}`).join('\n');
        if (confirm(`ORDER SUMMARY:\n\n${itemNames}\n\nTotal: $${total.toFixed(2)}\n\nSend to Queue?`)) {
            checkoutAction();
        }
    } else {
        checkoutAction();
    }
};

function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm)).sort((a,b) => b.fav - a.fav);

    // Cashier
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-3 overflow-hidden rounded-[1.8rem] bg-slate-50 relative pointer-events-none">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-4 h-4 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[13px] truncate px-1 pointer-events-none uppercase">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1 pointer-events-none">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Pending
    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
            <div class="bg-white px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-2 mb-3">
                <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Tag..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
            </div>
            <div class="flex flex-wrap gap-2 mb-4">
                ${ord.items.map(i => `<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">${i.name} x${i.qty}</span>`).join('')}
            </div>
            <div class="flex gap-2">
                <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve $${ord.total.toFixed(2)}</button>
                <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-400 rounded-2xl"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    // History
    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
        <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3 shadow-sm transition-all overflow-hidden" onclick="toggleOrderExpand(${idx})">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span>
                    <input type="text" value="${h.desc || ''}" onchange="event.stopPropagation(); updateTag('history', ${idx}, this.value)" class="font-bold text-slate-700 text-sm bg-transparent outline-none">
                </div>
                <div class="flex items-center gap-3">
                    <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
                    <button onclick="event.stopPropagation(); reorder(${idx})" class="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-colors">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    </button>
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

    // Stock
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none uppercase">
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-blue-600 font-black text-xs">$</span>
                    <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-xs outline-none">
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    if(topBadge) { topBadge.innerText = totalQty; topBadge.classList.toggle('hidden', totalQty === 0); }
    lucide.createIcons();
}

window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    if(topBadge) { topBadge.innerText = totalQty; topBadge.classList.remove('hidden'); }
};

window.reorder = idx => {
    const item = history[idx];
    orderCounter++;
    queue.unshift({ orderNum: orderCounter, items: JSON.parse(JSON.stringify(item.items)), total: item.total, desc: item.desc || "", date: new Date().toLocaleTimeString() });
    pushData();
};

window.updateTag = (list, idx, val) => {
    if(list === 'queue') queue[idx].desc = val;
    else history[idx].desc = val;
    pushData();
};

window.toggleOrderExpand = idx => { document.getElementById(`hist-card-${idx}`).classList.toggle('order-expanded'); };

window.editOrderDetails = idx => {
    const item = history[idx];
    cart = JSON.parse(JSON.stringify(item.items));
    history.splice(idx, 1);
    window.showView('cashier');
    pushData();
};

window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    const bO = document.getElementById('sub-btn-orders'), bS = document.getElementById('sub-btn-stock');
    if(sec === 'orders') {
        bO.className = "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600";
        bS.className = "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    } else {
        bS.className = "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600";
        bO.className = "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    }
};

window.removeItemFromList = (list, idx) => {
    if(list === 'queue') queue.splice(idx, 1);
    else history.splice(idx, 1);
    pushData();
};

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
    if(v === 'cashier') render();
};

window.approveOrder = idx => {
    history.unshift({ ...queue[idx], date: new Date().toLocaleString() });
    queue.splice(idx, 1); pushData();
};

window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleSearch = () => {
    const s = document.getElementById('search-container');
    s.classList.toggle('hidden');
    if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus();
};
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };

initTapMS();
