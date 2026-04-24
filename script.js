let db, products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All";

// --- CORE FUNCTIONS ---

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

window.addItem = () => { 
    products.unshift({ 
        id: Date.now(), 
        name: 'New Item', 
        price: 0, 
        img: '', 
        fav: false, 
        cat: '' 
    }); 
    pushData(); 
};

window.handleProductTap = (id) => {
    const el = document.getElementById(`prod-${id}`);
    if (el) {
        el.classList.remove('tap-feedback');
        void el.offsetWidth; 
        el.classList.add('tap-feedback');
    }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

// --- RENDERING ---

function render() {
    // 1. Independent Category List: Pulled from all products
    const allUniqueCats = [...new Set(products.map(p => p.cat || "").filter(Boolean))];
    const dl = document.getElementById('category-list');
    if(dl) dl.innerHTML = allUniqueCats.map(c => `<option value="${c}">`).join('');

    // 2. Persistent Category Bar: Buttons stay even when searching
    const cats = ["All", ...allUniqueCats];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    // 3. Filtered Products logic
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) && 
        (currentCat === "All" || (p.cat || "") === currentCat)
    ).sort((a,b) => b.fav - a.fav);

    // 4. Cashier Grid
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // 5. Stock List with "None" placeholder
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none">
                <div class="flex items-center gap-2 mt-1">
                    <input type="text" list="category-list" value="${p.cat || ''}" onchange="editItem(${p.id}, 'cat', this.value)" placeholder="None" class="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md outline-none">
                    <span class="text-blue-600 font-black text-xs">$</span>
                    <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-xs outline-none">
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'} active:scale-125 transition-all"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    if(topBadge) { topBadge.innerText = totalQty; topBadge.classList.toggle('hidden', totalQty === 0); }
    
    // Status dot fix: Turn green if db is ready
    if(db) document.getElementById('status-dot').className = "w-3 h-3 rounded-full dot-connected";
    
    lucide.createIcons();
}

// --- UTILS ---
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.setCategory = (cat) => { currentCat = cat; render(); };
window.toggleSearch = () => document.getElementById('search-container').classList.toggle('hidden');

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400';
};

window.confirmWipe = () => {
    if (confirm("Reset everything?")) {
        db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 });
        location.reload();
    }
};

async function init() {
    const response = await fetch('/api/config');
    const config = await response.json();
    firebase.initializeApp(config);
    db = firebase.database();
    db.ref('/').on('value', snap => {
        const data = snap.val() || {};
        products = data.products || [];
        queue = data.queue || [];
        history = data.history || [];
        orderCounter = data.orderCounter || 0;
        render();
    });
}
init();
