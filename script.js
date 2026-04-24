let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCategory = "All", summaryEnabled = false;

// SYSTEM WIPE
function triggerReset() {
    if (confirm("⚠️ CAUTION: Delete everything and reset the system?")) {
        db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 });
        location.reload();
    }
}

// TOGGLE SUMMARY LOGIC
function toggleSummarySetting() {
    summaryEnabled = !summaryEnabled;
    const btn = document.getElementById('summary-toggle-ui');
    const dot = document.getElementById('toggle-dot');
    btn.className = summaryEnabled ? "mt-3 flex items-center gap-3 bg-blue-50 px-5 py-2.5 rounded-full border border-blue-200 shadow-sm transition-all" : "mt-3 flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-slate-200 shadow-sm transition-all";
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600 shadow-lg" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    btn.querySelector('span').innerText = `Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
}

// INITIALIZE
async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        firebase.initializeApp(config);
        db = firebase.database(); auth = firebase.auth();
        auth.onAuthStateChanged(user => { 
            if (user) {
                document.getElementById('status-dot').classList.replace('bg-slate-200', 'bg-green-500');
                startSync(); 
            } else {
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456");
            }
        });
    } catch (e) { console.error("Config Error:", e); }
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

// RENDER INTERFACE
function render() {
    // Categories Bar
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('category-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-6 py-2.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCategory === c ? 'tag-active' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}">${c}</button>
    `).join('');

    // Cashier View
    const filtered = products.filter(p => (currentCategory === "All" || (p.category || "General") === currentCategory) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm active:scale-95 transition-all cursor-pointer" onclick="addToCart(${p.id})">
            <div class="aspect-square mb-4 overflow-hidden rounded-[2rem] bg-slate-100">
                <img src="${p.img || ''}" class="product-image" onerror="this.src='https://cdn-icons-png.flaticon.com/512/9402/9402314.png'">
            </div>
            <h3 class="font-bold text-center text-sm truncate text-slate-800 px-2">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1 tracking-tight">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Inventory List
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
            <div class="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0">
                <img src="${p.img}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="block w-full font-extrabold text-sm outline-none bg-transparent text-slate-800">
                <input type="text" value="${p.category || 'General'}" onchange="editItem(${p.id}, 'category', this.value)" placeholder="Category..." class="text-[10px] font-black text-slate-400 uppercase outline-none bg-transparent mt-1">
            </div>
            <div class="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100">
                <span class="text-blue-600 font-black text-xs">$</span>
                <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 text-right font-black text-sm bg-transparent outline-none text-slate-700">
            </div>
            <button onclick="removeItem(${p.id})" class="text-red-300 hover:text-red-500 transition-colors p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        </div>
    `).join('');

    lucide.createIcons();
}

// PURCHASE SYSTEM LOGIC
window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
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
    cart = []; pushData();
};

// UTILITIES
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.setCategory = c => { currentCategory = c; render(); };
window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('category-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('btn-cashier').className = (v === 'cashier') ? 'flex flex-col items-center gap-2 active-tab p-4' : 'flex flex-col items-center gap-2 text-slate-400 p-4';
    document.getElementById('btn-manage').className = (v === 'manage') ? 'flex flex-col items-center gap-2 active-tab p-4' : 'flex flex-col items-center gap-2 text-slate-400 p-4';
};
window.toggleManageSection = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('sub-btn-orders').className = (s === 'orders') ? "px-10 py-3 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-10 py-3 rounded-xl text-xs font-black uppercase text-slate-500";
    document.getElementById('sub-btn-stock').className = (s === 'stock') ? "px-10 py-3 rounded-xl text-xs font-black uppercase bg-white text-blue-600 shadow-md" : "px-10 py-3 rounded-xl text-xs font-black uppercase text-slate-500";
};
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', category: 'General' }); pushData(); };
window.removeItem = id => { if(confirm("Remove item?")) { products = products.filter(x => x.id !== id); pushData(); } };
window.toggleSearch = () => { const v = prompt("Search Product:"); if(v !== null) { searchTerm = v.toLowerCase(); render(); } };

initTapMS();
