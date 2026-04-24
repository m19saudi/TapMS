let db, auth, products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

function promptWipe() { if(confirm("Wipe all data?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } }

async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        firebase.initializeApp(config);
        db = firebase.database();
        auth = firebase.auth();
        auth.onAuthStateChanged(user => {
            if (user) {
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
    if(navb) navb.classList.toggle('hidden', queue.length === 0);

    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCat('${c}')" class="px-6 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    const filtered = products.filter(p => (currentCat === "All" || (p.category || "General") === currentCat) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="item-card bg-white p-5 rounded-[3rem] border border-slate-100 shadow-sm" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-4 overflow-hidden rounded-[2.2rem] bg-slate-50">
                <img src="${p.img || ''}" class="product-image">
            </div>
            <h3 class="font-bold text-center text-sm truncate uppercase tracking-tight">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock List with Category Quick Picker preserved
    document.getElementById('inventory-list').innerHTML = [...products].reverse().map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-5">
            <div class="w-16 h-16 shrink-0 rounded-2xl bg-slate-50 overflow-hidden relative">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white text-[8px] text-center">
            </div>
            <div class="flex-1 overflow-hidden">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold bg-transparent outline-none uppercase">
                <div class="flex items-center gap-2 mt-2">
                    <input type="text" value="${p.category || ''}" onchange="editItem(${p.id}, 'category', this.value)" class="text-[10px] font-black text-blue-600 bg-slate-50 px-2 py-1 rounded-lg w-20 outline-none uppercase">
                    <div class="flex gap-1 overflow-x-auto no-scrollbar">
                        ${cats.filter(c => c !== "All" && c !== p.category).map(c => `
                            <button onclick="editItem(${p.id}, 'category', '${c}')" class="shrink-0 text-[8px] font-bold bg-white text-slate-400 px-2 py-1 rounded-lg border border-slate-100 uppercase">${c}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-blue-600 font-black text-sm">$</span>
                    <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-20 font-black text-sm outline-none">
                </div>
            </div>
            <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-6 h-6"></i></button>
        </div>
    `).join('');

    renderManageLists();
    updateCartCount();
    lucide.createIcons();
}

window.handleProductTap = id => {
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
    const newOrder = { orderNum: orderCounter, items: [...cart], total, date: new Date().toLocaleTimeString() };
    queue.unshift(newOrder);
    if (summaryEnabled) { openSummary(newOrder); } 
    else { cart = []; render(); pushData(); }
};

function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `
        <div class="flex justify-between items-center text-[10px] font-bold uppercase">
            <span class="text-slate-600">${i.name} x${i.qty}</span>
            <span class="text-slate-400">$${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');
    document.getElementById('summary-overlay').classList.add('active');
    cart = []; render(); pushData();
}

window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');

function renderManageLists() {
    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-xl px-4 uppercase">Pending Orders</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-6 rounded-[3rem] border-2 border-blue-100 mb-4">
            <div class="flex justify-between mb-4">
                <span class="text-blue-600 font-black text-xs">#${ord.orderNum}</span>
                <span class="text-slate-400 font-bold text-[10px] uppercase">${ord.date}</span>
            </div>
            <div class="space-y-1 mb-4">${ord.items.map(i => `<div class="text-[11px] font-bold uppercase">${i.name} x${i.qty}</div>`).join('')}</div>
            <button onclick="approveOrder(${idx})" class="w-full bg-blue-600 text-white py-4 rounded-[1.5rem] font-black uppercase text-[11px]">Approve $${ord.total.toFixed(2)}</button>
        </div>
    `).join('');

    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-xl px-4 text-slate-400 uppercase">History</h2>` + history.map((h, idx) => `
        <div class="bg-white p-6 rounded-[3rem] border border-slate-100 mb-4 flex justify-between items-center">
            <div>
                <span class="text-slate-400 font-black text-xs block">#${h.orderNum}</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase">${h.date}</span>
            </div>
            <p class="font-black text-blue-600">$${h.total.toFixed(2)}</p>
        </div>
    `).join('');
}

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 active-tab p-4 transition-all':'flex flex-col items-center gap-2 text-slate-400 p-4 transition-all';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 active-tab p-4 transition-all':'flex flex-col items-center gap-2 text-slate-400 p-4 transition-all';
    lucide.createIcons();
};

window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', category: 'General' }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.setCat = c => { currentCat = c; render(); };
window.toggleSearch = () => { document.getElementById('search-container').classList.toggle('hidden'); };
window.filterProducts = v => { searchTerm = v.toLowerCase(); render(); };
window.toggleManageSection = s => { document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders'); document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock'); document.getElementById('sub-btn-orders').className = s === 'orders' ? "px-12 py-3.5 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-12 py-3.5 rounded-xl text-xs font-black uppercase text-slate-500"; document.getElementById('sub-btn-stock').className = s === 'stock' ? "px-12 py-3.5 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-12 py-3.5 rounded-xl text-xs font-black uppercase text-slate-500"; };

initTapMS();
