let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCategory = "All", summaryEnabled = false;

function triggerReset() { if (confirm("System Wipe?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } }

async function initTapMS() {
    const response = await fetch('/api/config');
    const config = await response.json();
    firebase.initializeApp(config);
    db = firebase.database(); auth = firebase.auth();
    auth.onAuthStateChanged(user => { 
        if (user) { 
            document.getElementById('status-dot').className = "w-3 h-3 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
            startSync(); 
        } else auth.signInWithEmailAndPassword("admin@gmail.com", "123456");
    });
}

function startSync() {
    db.ref('/').on('value', snap => {
        const d = snap.val() || {};
        products = d.products || []; 
        queue = d.queue || []; 
        history = d.history || []; 
        orderCounter = d.orderCounter || 0;
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

function render() {
    // Badges
    const itemsInCart = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-count').innerText = itemsInCart;
    document.getElementById('cart-count').classList.toggle('hidden', itemsInCart === 0);
    document.getElementById('manage-notif').classList.toggle('hidden', queue.length === 0);
    document.getElementById('order-notif').classList.toggle('hidden', queue.length === 0);

    // Category Rendering
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('category-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-7 py-3 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCategory === c ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    // Cashier Cards
    const filtered = products.filter(p => (currentCategory === "All" || (p.category || "General") === currentCategory) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="item-card bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative" onclick="addToCart(${p.id})">
            ${p.starred ? '<div class="absolute top-8 right-8 z-10"><i data-lucide="star" class="w-5 h-5 text-amber-400 fill-amber-400"></i></div>' : ''}
            <div class="aspect-square mb-5 overflow-hidden rounded-[2rem] ${p.img ? '' : 'img-empty'}">
                ${p.img ? `<img src="${p.img}" class="w-full h-full object-cover rounded-[1.8rem]">` : '<i data-lucide="image" class="w-10 h-10"></i>'}
            </div>
            <h3 class="font-bold text-center text-sm truncate text-slate-800 uppercase px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1.5">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Orders Page Logic
    document.getElementById('pending-list').innerHTML = queue.length ? `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">Pending Orders (${queue.length})</h4>` + queue.map((q, idx) => `
        <div class="bg-white p-7 rounded-[3rem] border border-blue-100 shadow-sm flex justify-between items-center animate-pop">
            <div>
                <p class="font-black text-xl text-slate-900">#${q.orderNum}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">${q.items.length} Items • ${q.date}</p>
            </div>
            <div class="flex items-center gap-6">
                <span class="font-black text-blue-600 text-2xl tracking-tighter">$${q.total.toFixed(2)}</span>
                <button onclick="approveOrder(${idx})" class="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90"><i data-lucide="check" class="w-6 h-6"></i></button>
            </div>
        </div>
    `).join('') : '<p class="text-center py-20 text-slate-300 font-black uppercase text-[10px] tracking-widest">Queue Empty</p>';

    document.getElementById('history-list').innerHTML = history.length ? `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">Completed History</h4>` + history.slice(0, 5).map(h => `
        <div class="bg-slate-50 p-5 rounded-[2.5rem] border border-slate-100 flex justify-between items-center opacity-60">
            <p class="font-bold text-xs text-slate-500">Order #${h.orderNum} <span class="ml-2 font-normal text-[9px] uppercase tracking-wider">${h.date}</span></p>
            <span class="font-black text-slate-600 text-xs">$${h.total.toFixed(2)}</span>
        </div>
    `).join('') : '';

    // Stock Management (Star next to Delete)
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div class="relative w-16 h-16 shrink-0 cursor-pointer group" onclick="changeImage(${p.id})">
                <div class="w-full h-full rounded-2xl overflow-hidden ${p.img ? '' : 'img-empty'}">
                    ${p.img ? `<img src="${p.img}" class="w-full h-full object-cover">` : '<i data-lucide="image" class="w-6 h-6"></i>'}
                </div>
                <div class="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="camera" class="w-5 h-5 text-white"></i></div>
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="block w-full font-extrabold text-sm outline-none bg-transparent text-slate-800 uppercase tracking-tight">
                <input type="text" value="${p.category || 'General'}" onchange="editItem(${p.id}, 'category', this.value)" class="text-[10px] font-black text-slate-400 uppercase outline-none bg-transparent mt-1">
            </div>
            <div class="flex items-center gap-1 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                <span class="text-blue-600 font-black text-xs">$</span>
                <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 text-right font-black text-sm text-slate-700 bg-transparent outline-none">
            </div>
            <div class="flex items-center gap-2 pr-2">
                <button onclick="toggleStar(${p.id})" class="${p.starred ? 'text-amber-400' : 'text-slate-200'} p-2 active:scale-125 transition-all"><i data-lucide="star" class="w-6 h-6 fill-current"></i></button>
                <button onclick="removeItem(${p.id})" class="text-slate-200 hover:text-red-500 transition-colors p-2"><i data-lucide="trash-2" class="w-6 h-6"></i></button>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

// RESTORED DYNAMIC SEARCH
window.doSearch = (val) => { searchTerm = val.toLowerCase(); render(); };
window.setCategory = c => { currentCategory = c; render(); };
window.addToCart = (id) => { const p = products.find(x => x.id === id); const entry = cart.find(i => i.id === id); if(entry) entry.qty++; else cart.push({...p, qty: 1}); render(); };
window.toggleStar = id => { const p = products.find(x => x.id === id); p.starred = !p.starred; pushData(); };
window.changeImage = id => { const p = products.find(x => x.id === id); const url = prompt("Paste Image URL:", p.img || ""); if(url !== null) { p.img = url; pushData(); } };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    queue.unshift(order);
    
    if(summaryEnabled) {
        document.getElementById('sum-total').innerText = `$${total.toFixed(2)}`;
        document.getElementById('sum-id').innerText = `#${orderCounter}`;
        document.getElementById('sum-details').innerHTML = cart.map(i => `<div class="flex justify-between font-black text-[10px] text-slate-700 uppercase"><span>${i.qty}x ${i.name}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('');
        document.getElementById('summary-overlay').classList.add('active');
    }
    cart = []; render(); pushData();
};

window.approveOrder = (idx) => { const order = queue.splice(idx, 1)[0]; history.unshift(order); pushData(); };
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('category-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('btn-cashier').className = (v === 'cashier') ? 'flex flex-col items-center gap-2 active-tab p-5' : 'flex flex-col items-center gap-2 text-slate-400 p-5';
    document.getElementById('btn-manage').className = (v === 'manage') ? 'flex flex-col items-center gap-2 active-tab p-5' : 'flex flex-col items-center gap-2 text-slate-400 p-5';
};

window.toggleManageSection = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('sub-btn-orders').className = (s === 'orders') ? "relative px-12 py-3.5 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-12 py-3.5 rounded-xl text-xs font-black uppercase text-slate-500";
    document.getElementById('sub-btn-stock').className = (s === 'stock') ? "relative px-12 py-3.5 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-12 py-3.5 rounded-xl text-xs font-black uppercase text-slate-500";
};

window.toggleSummarySetting = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    document.getElementById('summary-toggle-ui').querySelector('span').innerText = `Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
};

window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'NEW ITEM', price: 0, img: '', category: 'GENERAL', starred: false }); pushData(); };

initTapMS();
