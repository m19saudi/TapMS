let db, auth, products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

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
                auth.signInAnonymously(); // Simple anonymous auth for dev
            }
        });
    } catch (e) { console.error("Initialization Failed", e); }
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
    // Notification Badge
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);

    // Categories
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCat('${c}')" class="px-6 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    // Cashier
    const filtered = products.filter(p => (currentCat === "All" || (p.category || "General") === currentCat) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="bg-white p-5 rounded-[3rem] border border-slate-100 shadow-sm active:scale-95 transition-all" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-4 overflow-hidden rounded-[2.2rem] bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
            </div>
            <h3 class="font-bold text-center text-xs truncate uppercase">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-1">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock
    document.getElementById('inventory-list').innerHTML = [...products].reverse().map(p => `
        <div class="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-4">
            <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="flex-1 font-bold outline-none uppercase text-xs">
            <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-blue-600 outline-none text-xs">
            <button onclick="removeItem(${p.id})" class="text-red-200 hover:text-red-500"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        </div>
    `).join('');

    renderManageLists();
    lucide.createIcons();
}

function renderManageLists() {
    const pList = document.getElementById('pending-list');
    const hList = document.getElementById('history-list');

    pList.innerHTML = `<h2 class="font-black text-lg px-2 uppercase">Pending Orders</h2>` + 
    (queue.length === 0 ? `<p class="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Empty Queue</p>` : 
    queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-6 rounded-[2.5rem] border-2 border-blue-100 space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-blue-600 font-black text-xs">#${ord.orderNum}</span>
                <span class="text-slate-400 font-bold text-[10px] uppercase">${ord.date}</span>
            </div>
            <div class="space-y-1">${ord.items.map(i => `<div class="text-[11px] font-bold uppercase">${i.name} x${i.qty}</div>`).join('')}</div>
            <button onclick="approveOrder(${idx})" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Complete Order</button>
        </div>
    `).join(''));

    hList.innerHTML = `<h2 class="font-black text-lg px-2 text-slate-300 uppercase">Archive</h2>` + 
    history.slice(0, 5).map(h => `
        <div class="bg-white p-4 rounded-[2rem] border border-slate-100 flex justify-between items-center opacity-50">
            <span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span>
            <p class="font-black text-slate-400 text-xs">$${h.total.toFixed(2)}</p>
        </div>
    `).join('');
}

// Database Export/Import
window.exportDatabase = () => {
    const dataStr = JSON.stringify(products, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "tapms_inventory.json"; a.click();
};

window.importDatabase = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(confirm(`Import ${data.length} items?`)) { products = data; pushData(); }
        } catch(err) { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
};

window.handleProductTap = id => {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    updateCart();
};

function updateCart() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-count-top').innerText = count;
    document.getElementById('cart-count-top').classList.toggle('hidden', count === 0);
}

window.checkoutToQueue = () => {
    if(!cart.length) return;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    orderCounter++;
    const newOrder = { orderNum: orderCounter, items: [...cart], total, date: new Date().toLocaleTimeString() };
    queue.unshift(newOrder);
    if(summaryEnabled) openSummary(newOrder);
    cart = []; updateCart(); pushData();
};

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

window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, category: 'General' }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = f==='price'?parseFloat(v):v; pushData(); };
window.setCat = c => { currentCat = c; render(); };
window.toggleSearch = () => document.getElementById('search-container').classList.toggle('hidden');
window.filterProducts = v => { searchTerm = v.toLowerCase(); render(); };
window.toggleSummary = () => { summaryEnabled = !summaryEnabled; render(); };

initTapMS();
