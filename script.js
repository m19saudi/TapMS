let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCategory = "All", summaryEnabled = false;

function triggerReset() { if (confirm("⚠️ Wipe all data?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } }

async function initTapMS() {
    const response = await fetch('/api/config');
    const config = await response.json();
    firebase.initializeApp(config);
    db = firebase.database(); auth = firebase.auth();
    auth.onAuthStateChanged(user => { 
        if (user) { 
            document.getElementById('status-dot').className = "w-3 h-3 rounded-full bg-green-500 shadow-lg";
            startSync(); 
        } else auth.signInWithEmailAndPassword("admin@gmail.com", "123456");
    });
}

function startSync() {
    db.ref('/').on('value', snap => {
        const d = snap.val() || {};
        products = d.products || []; queue = d.queue || []; history = d.history || []; orderCounter = d.orderCounter || 0;
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

function render() {
    // Nav Badges
    const itemsInCart = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-count').innerText = itemsInCart;
    document.getElementById('cart-count').classList.toggle('hidden', itemsInCart === 0);
    document.getElementById('manage-notif').classList.toggle('hidden', queue.length === 0);
    document.getElementById('order-notif').classList.toggle('hidden', queue.length === 0);

    // Categories
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('category-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-6 py-2.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCategory === c ? 'tag-active' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}">${c}</button>
    `).join('');

    // Cashier Cards (Dynamic Filter)
    const filtered = products.filter(p => (currentCategory === "All" || (p.category || "General") === currentCategory) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm active:scale-95 transition-all cursor-pointer relative" onclick="addToCart(${p.id})">
            ${p.starred ? '<i data-lucide="star" class="absolute top-8 right-8 w-5 h-5 text-amber-400 fill-amber-400 z-10"></i>' : ''}
            <div class="aspect-square mb-4 overflow-hidden rounded-[2rem] bg-slate-50">
                <img src="${p.img || 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'}" class="product-image">
            </div>
            <h3 class="font-bold text-center text-sm truncate text-slate-800 px-2">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Orders Management
    document.getElementById('pending-list').innerHTML = `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Pending Approval (${queue.length})</h4>` + queue.map((q, idx) => `
        <div class="bg-white p-6 rounded-[2.5rem] border border-blue-100 shadow-sm flex justify-between items-center animate-pop">
            <div>
                <p class="font-black text-lg text-slate-900">Order #${q.orderNum}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase">${q.items.length} items • ${q.date}</p>
            </div>
            <div class="flex items-center gap-4">
                <span class="font-black text-blue-600 text-xl">$${q.total.toFixed(2)}</span>
                <button onclick="approveOrder(${idx})" class="bg-blue-600 text-white p-3 rounded-2xl shadow-lg active:scale-90"><i data-lucide="check" class="w-6 h-6"></i></button>
            </div>
        </div>
    `).join('');

    document.getElementById('history-list').innerHTML = `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Recently Completed</h4>` + history.slice(0, 5).map(h => `
        <div class="bg-slate-50 p-5 rounded-[2rem] flex justify-between items-center opacity-60">
            <p class="font-bold text-xs">#${h.orderNum}</p>
            <span class="font-bold text-xs">$${h.total.toFixed(2)}</span>
        </div>
    `).join('');

    // Stock Management (Manual Image Edit)
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div class="relative w-14 h-14 shrink-0 group cursor-pointer" onclick="changeImage(${p.id})">
                <img src="${p.img || 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'}" class="w-full h-full object-cover rounded-2xl bg-slate-100">
                <div class="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="camera" class="w-4 h-4 text-white"></i></div>
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="block w-full font-extrabold text-sm outline-none bg-transparent">
                <div class="flex gap-3 mt-1 items-center">
                    <input type="text" value="${p.category || 'General'}" onchange="editItem(${p.id}, 'category', this.value)" class="text-[10px] font-black text-slate-400 uppercase outline-none bg-transparent">
                    <button onclick="toggleStar(${p.id})" class="${p.starred ? 'text-amber-400' : 'text-slate-200'} active:scale-125 transition-all"><i data-lucide="star" class="w-4 h-4 fill-current"></i></button>
                </div>
            </div>
            <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-20 text-right font-black text-sm text-blue-600 bg-transparent outline-none">
            <button onclick="removeItem(${p.id})" class="text-red-200 hover:text-red-500 transition-colors p-2"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
    `).join('');

    lucide.createIcons();
}

// RESTORED DYNAMIC SEARCH
window.doSearch = (val) => { searchTerm = val.toLowerCase(); render(); };
window.setCategory = c => { currentCategory = c; render(); };
window.addToCart = (id) => { const p = products.find(x => x.id === id); const entry = cart.find(i => i.id === id); if(entry) entry.qty++; else cart.push({...p, qty: 1}); render(); };
window.toggleStar = id => { const p = products.find(x => x.id === id); p.starred = !p.starred; pushData(); };
window.changeImage = id => { const p = products.find(x => x.id === id); const url = prompt("Image URL:", p.img); if(url) { p.img = url; pushData(); } };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, date: new Date().toLocaleTimeString() };
    queue.unshift(order);
    
    if(summaryEnabled) {
        document.getElementById('sum-total').innerText = `$${total.toFixed(2)}`;
        document.getElementById('sum-id').innerText = `#${orderCounter}`;
        document.getElementById('sum-details').innerHTML = cart.map(i => `<div class="flex justify-between font-bold text-xs"><span>${i.qty}x ${i.name}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('');
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
    document.getElementById('btn-cashier').className = (v === 'cashier') ? 'flex flex-col items-center gap-2 active-tab p-4 transition-all' : 'flex flex-col items-center gap-2 text-slate-400 p-4 transition-all';
    document.getElementById('btn-manage').className = (v === 'manage') ? 'flex flex-col items-center gap-2 active-tab p-4 transition-all' : 'flex flex-col items-center gap-2 text-slate-400 p-4 transition-all';
};

window.toggleManageSection = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('sub-btn-orders').className = (s === 'orders') ? "relative px-10 py-3 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-10 py-3 rounded-xl text-xs font-black uppercase text-slate-500";
    document.getElementById('sub-btn-stock').className = (s === 'stock') ? "px-10 py-3 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-10 py-3 rounded-xl text-xs font-black uppercase text-slate-500";
};

window.toggleSummarySetting = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600 shadow-lg" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    document.getElementById('summary-toggle-ui').querySelector('span').innerText = `Checkout Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
};

window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', category: 'General', starred: false }); pushData(); };

initTapMS();
