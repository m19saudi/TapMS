let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCategory = "All", summaryEnabled = false;

// SINGLE CLICK RESET WITH CONFIRMATION
function triggerReset() {
    if (confirm("⚠️ CRITICAL: Wipe all data and reset the system? This cannot be undone.")) {
        db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 });
        location.reload();
    }
}

// Summary Logic
function toggleSummarySetting() {
    summaryEnabled = !summaryEnabled;
    const btn = document.getElementById('summary-toggle-ui');
    const dot = document.getElementById('toggle-dot');
    btn.classList.toggle('border-blue-200', summaryEnabled);
    btn.classList.toggle('bg-blue-50', summaryEnabled);
    dot.className = summaryEnabled ? "w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "w-2 h-2 rounded-full bg-slate-300";
    btn.querySelector('span').innerText = `Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
}

async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        firebase.initializeApp(config);
        db = firebase.database(); auth = firebase.auth();
        auth.onAuthStateChanged(user => { 
            if (user) {
                document.getElementById('status-dot').className = "w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]";
                startSync(); 
            } else {
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456");
            }
        });
    } catch (e) { console.error(e); }
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
    // Categories Bar
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('category-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all ${currentCategory === c ? 'tag-active' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}">${c}</button>
    `).join('');

    // Cashier Grid (Optimized for PC Smallness)
    const filtered = products.filter(p => (currentCategory === "All" || (p.category || "General") === currentCategory) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="bg-white p-3 rounded-[1.8rem] border border-slate-100 shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="addToCart(${p.id})">
            <div class="aspect-square mb-2 overflow-hidden rounded-[1.3rem] bg-slate-50">
                <img src="${p.img || ''}" class="product-image group-hover:scale-110 transition-transform duration-500">
            </div>
            <h3 class="font-bold text-center text-[10px] truncate px-1 text-slate-700">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-0.5 tracking-tight">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock/Inventory
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 shadow-sm">
            <img src="${p.img}" class="w-12 h-12 rounded-2xl object-cover bg-slate-100">
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="block w-full font-bold text-xs outline-none bg-transparent">
                <input type="text" value="${p.category || 'General'}" onchange="editItem(${p.id}, 'category', this.value)" placeholder="Category..." class="text-[9px] font-bold text-slate-400 uppercase outline-none bg-transparent mt-0.5">
            </div>
            <div class="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl">
                <span class="text-blue-600 font-black text-[10px]">$</span>
                <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-14 text-right font-black text-xs bg-transparent outline-none">
            </div>
            <button onclick="removeItem(${p.id})" class="text-red-300 hover:text-red-500 transition-colors p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
    `).join('');

    lucide.createIcons();
}

window.setCategory = c => { currentCategory = c; render(); };
window.addToCart = id => {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if(entry) entry.qty++; else cart.push({...p, qty: 1});
};

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    queue.unshift({ orderNum: orderCounter, items: [...cart], total, date: new Date().toLocaleTimeString() });
    
    if(summaryEnabled) {
        document.getElementById('sum-total').innerText = `$${total.toFixed(2)}`;
        document.getElementById('sum-id').innerText = `#${orderCounter}`;
        document.getElementById('summary-overlay').classList.add('active');
    }
    cart = []; render(); pushData();
};

window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('category-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('btn-cashier').className = (v === 'cashier') ? 'flex flex-col items-center gap-1 active-tab p-2' : 'flex flex-col items-center gap-1 text-slate-400 p-2';
    document.getElementById('btn-manage').className = (v === 'manage') ? 'flex flex-col items-center gap-1 active-tab p-2' : 'flex flex-col items-center gap-1 text-slate-400 p-2';
};
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', category: 'General' }); pushData(); };
window.removeItem = id => { if(confirm("Delete item?")) { products = products.filter(x => x.id !== id); pushData(); } };
window.toggleSearch = () => {
    const val = prompt("Search Products:");
    if(val !== null) { searchTerm = val.toLowerCase(); render(); }
};

initTapMS();
