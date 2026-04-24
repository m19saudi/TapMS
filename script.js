let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCategory = "All", summaryEnabled = false;

function triggerReset() { if (confirm("Reset System?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } }

async function initTapMS() {
    const resp = await fetch('/api/config');
    const config = await resp.json();
    firebase.initializeApp(config);
    db = firebase.database(); auth = firebase.auth();
    auth.onAuthStateChanged(user => { 
        if (user) { 
            document.getElementById('status-dot').className = "w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg";
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
    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-count').innerText = cartCount;
    document.getElementById('cart-count').classList.toggle('hidden', cartCount === 0);
    document.getElementById('manage-notif').classList.toggle('hidden', queue.length === 0);
    document.getElementById('order-notif').classList.toggle('hidden', queue.length === 0);

    // Category Tags
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('category-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCategory === c ? 'tag-active' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    // Cashier Cards
    const filtered = products.filter(p => (currentCategory === "All" || (p.category || "General") === currentCategory) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all cursor-pointer relative" onclick="addToCart(${p.id})">
            ${p.starred ? '<i data-lucide="star" class="absolute top-6 right-6 w-4 h-4 text-amber-400 fill-amber-400 z-10"></i>' : ''}
            <div class="aspect-square mb-3 overflow-hidden rounded-[1.5rem] bg-slate-50">
                <img src="${p.img || 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'}" class="product-image">
            </div>
            <h3 class="font-bold text-center text-xs truncate text-slate-800 px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Manage > Orders
    document.getElementById('pending-list').innerHTML = `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pending Approval (${queue.length})</h4>` + queue.map((q, idx) => `
        <div class="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm flex justify-between items-center">
            <div>
                <p class="font-black text-sm text-slate-900">Order #${q.orderNum}</p>
                <p class="text-[10px] font-bold text-slate-400">${q.items.length} items • ${q.date}</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-black text-blue-600 text-sm">$${q.total.toFixed(2)}</span>
                <button onclick="approveOrder(${idx})" class="bg-blue-600 text-white p-2 rounded-xl"><i data-lucide="check" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');

    document.getElementById('history-list').innerHTML = `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Completed</h4>` + history.slice(0, 10).map(h => `
        <div class="bg-slate-50 p-4 rounded-2xl flex justify-between items-center opacity-60">
            <p class="font-bold text-xs">#${h.orderNum}</p>
            <span class="font-bold text-xs">$${h.total.toFixed(2)}</span>
        </div>
    `).join('');

    // Manage > Stock
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-4 shadow-sm">
            <div class="relative w-12 h-12 shrink-0 cursor-pointer" onclick="changeImage(${p.id})">
                <img src="${p.img || 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'}" class="w-full h-full object-cover rounded-xl bg-slate-50">
                <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 rounded-xl transition-opacity"><i data-lucide="camera" class="w-4 h-4 text-white"></i></div>
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="block w-full font-bold text-xs outline-none bg-transparent">
                <div class="flex gap-2 mt-1">
                    <input type="text" value="${p.category || 'General'}" onchange="editItem(${p.id}, 'category', this.value)" class="text-[9px] font-bold text-slate-400 uppercase outline-none bg-transparent w-20">
                    <button onclick="toggleStar(${p.id})" class="${p.starred ? 'text-amber-400' : 'text-slate-200'}"><i data-lucide="star" class="w-3 h-3 fill-current"></i></button>
                </div>
            </div>
            <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-14 text-right font-black text-xs text-blue-600 outline-none bg-transparent">
            <button onclick="removeItem(${p.id})" class="text-slate-300 hover:text-red-500 transition-colors p-1"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    `).join('');

    lucide.createIcons();
}

// Logic Functions
window.doSearch = (val) => { searchTerm = val.toLowerCase(); render(); };
window.setCategory = c => { currentCategory = c; render(); };
window.addToCart = (id) => { const p = products.find(x => x.id === id); const entry = cart.find(i => i.id === id); if(entry) entry.qty++; else cart.push({...p, qty: 1}); render(); };
window.toggleStar = id => { const p = products.find(x => x.id === id); p.starred = !p.starred; pushData(); };
window.changeImage = id => { const p = products.find(x => x.id === id); const url = prompt("Enter Image URL:", p.img); if(url) { p.img = url; pushData(); } };
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
        document.getElementById('sum-details').innerHTML = cart.map(i => `<div class="flex justify-between text-[10px] font-bold py-1 border-b border-slate-100"><span>${i.qty}x ${i.name}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('');
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
    document.getElementById('btn-cashier').className = (v === 'cashier') ? 'flex flex-col items-center gap-1 active-tab p-4' : 'flex flex-col items-center gap-1 text-slate-400 p-4';
    document.getElementById('btn-manage').className = (v === 'manage') ? 'flex flex-col items-center gap-1 active-tab p-4' : 'flex flex-col items-center gap-1 text-slate-400 p-4';
};

window.toggleManageSection = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('sub-btn-orders').classList.toggle('bg-white', s === 'orders');
    document.getElementById('sub-btn-orders').classList.toggle('text-blue-600', s === 'orders');
    document.getElementById('sub-btn-stock').classList.toggle('bg-white', s === 'stock');
    document.getElementById('sub-btn-stock').classList.toggle('text-blue-600', s === 'stock');
};

window.toggleSummarySetting = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    dot.className = summaryEnabled ? "w-2 h-2 rounded-full bg-blue-600 shadow-lg" : "w-2 h-2 rounded-full bg-slate-300";
    document.getElementById('summary-toggle-ui').querySelector('span').innerText = `Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
};

window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', category: 'General', starred: false }); pushData(); };

initTapMS();
