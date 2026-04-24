let db, auth, products = [], cart = [], queue = [], history = [], orderCounter = 0;
let currentCat = "All", summaryEnabled = false, searchTerm = "";

async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        firebase.initializeApp(config);
        db = firebase.database();
        auth = firebase.auth();
        auth.onAuthStateChanged(user => {
            if (user) {
                document.getElementById('status-dot').classList.replace('bg-slate-200', 'bg-green-500');
                startSync();
            } else { auth.signInAnonymously(); }
        });
    } catch (e) { console.error(e); }
}

function promptWipe() { if(confirm("ARE YOU SURE? This wipes everything!")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } }

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

    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCat('${c}')" class="px-6 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    const filtered = products.filter(p => (currentCat === "All" || (p.category || "General") === currentCat) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="bg-white p-5 rounded-[3rem] border border-slate-100 shadow-sm active:scale-95 transition-all" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-4 overflow-hidden rounded-[2.2rem] bg-slate-50"><img src="${p.img || ''}" class="w-full h-full object-cover"></div>
            <h3 class="font-bold text-center text-[11px] truncate uppercase">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-1">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // RESTORED: Full Inventory Item Design
    document.getElementById('inventory-list').innerHTML = [...products].reverse().map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-4">
            <div class="w-14 h-14 shrink-0 rounded-2xl bg-slate-50 overflow-hidden relative">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white text-[8px] text-center outline-none" placeholder="Img URL">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold bg-transparent outline-none uppercase text-xs">
                <div class="flex gap-1 mt-1 overflow-x-auto no-scrollbar">${cats.filter(c => c !== "All").map(c => `<button onclick="editItem(${p.id}, 'category', '${c}')" class="shrink-0 text-[8px] font-bold ${p.category === c ? 'text-blue-600 bg-blue-50' : 'text-slate-400'} px-2 py-1 rounded-lg uppercase">${c}</button>`).join('')}</div>
            </div>
            <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-blue-600 text-xs outline-none text-right">
            <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        </div>
    `).join('');

    renderManageLists();
    lucide.createIcons();
}

function renderManageLists() {
    const pList = document.getElementById('pending-list');
    const hList = document.getElementById('history-list');

    pList.innerHTML = `<h2 class="font-black text-lg px-4 uppercase text-slate-900">Pending Orders</h2>` + 
    (queue.length === 0 ? `<p class="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Queue Clear</p>` : 
    queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-6 rounded-[3rem] border-2 border-blue-100 flex flex-col gap-4">
            <div class="flex justify-between items-center"><span class="bg-blue-600 text-white font-black px-4 py-1 rounded-full text-[10px]">#${ord.orderNum}</span><span class="text-slate-400 font-bold text-[10px] uppercase">${ord.date}</span></div>
            <div class="space-y-1">${ord.items.map(i => `<div class="text-[11px] font-bold uppercase text-slate-700">${i.name} <span class="text-blue-600">x${i.qty}</span></div>`).join('')}</div>
            <button onclick="approveOrder(${idx})" class="w-full bg-blue-600 text-white py-4 rounded-[1.5rem] font-black uppercase text-[10px] shadow-lg active:scale-95">Approve $${ord.total.toFixed(2)}</button>
        </div>
    `).join(''));

    hList.innerHTML = `<h2 class="font-black text-lg px-4 uppercase text-slate-400">History</h2>` + 
    history.slice(0, 5).map(h => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex justify-between items-center opacity-60"><div><span class="text-slate-400 font-black text-[10px] uppercase">#${h.orderNum}</span><span class="text-[9px] font-bold text-slate-300 block uppercase">${h.date}</span></div><p class="font-black text-slate-400 text-sm">$${h.total.toFixed(2)}</p></div>
    `).join('');
}

window.showDataOptions = () => {
    const choice = prompt("Type 'export' to save data or 'import' to load a file:");
    if (choice === 'export') {
        const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "tapms_db.json"; a.click();
    } else if (choice === 'import') { document.getElementById('db-import-input').click(); }
};

window.importDatabase = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => { products = JSON.parse(event.target.result); pushData(); alert("Imported!"); };
    reader.readAsText(e.target.files[0]);
};

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
    if (summaryEnabled) openSummary(newOrder);
    cart = []; updateCartCount(); pushData();
};

function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-bold uppercase"><span class="text-slate-600">${i.name} x${i.qty}</span><span class="text-slate-400">$${(i.price * i.qty).toFixed(2)}</span></div>`).join('');
    document.getElementById('summary-overlay').classList.add('active');
}

window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.approveOrder = (idx) => { history.unshift(queue[idx]); queue.splice(idx, 1); pushData(); };
window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').classList.toggle('active-tab', v === 'cashier');
    document.getElementById('btn-manage').classList.toggle('active-tab', v === 'manage');
};

window.toggleManageSection = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('sub-btn-orders').classList.toggle('bg-white', s === 'orders');
    document.getElementById('sub-btn-stock').classList.toggle('bg-white', s === 'stock');
};

window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('summary-toggle-ui').querySelector('span');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    label.innerText = summaryEnabled ? "Summary: ON" : "Summary: OFF";
    label.className = summaryEnabled ? "text-[10px] font-black uppercase text-blue-600" : "text-[10px] font-black uppercase text-slate-500";
};

window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', category: 'General' }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.setCat = c => { currentCat = c; render(); };
window.toggleSearch = () => document.getElementById('cat-bar').classList.toggle('hidden');
window.filterProducts = v => { searchTerm = v.toLowerCase(); render(); };

initTapMS();
