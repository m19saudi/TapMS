let YOUR_UID = "";
let db, auth, resetTimer;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

// ... [Keep startReset, stopReset, initTapMS, startSync, pushData from previous code] ...

function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // Category Management
    const cats = ["All", ...new Set(products.map(p => p.cat || "Other"))];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) && 
        (currentCat === "All" || p.cat === currentCat)
    ).sort((a,b) => b.fav - a.fav);

    // Cashier (Smaller items for PC, includes tap-feedback)
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[11px] truncate px-1 pointer-events-none">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-0.5 pointer-events-none">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock Management (Includes Category Input)
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none">
                <div class="flex items-center gap-2 mt-1">
                    <input type="text" value="${p.cat || 'Other'}" onchange="editItem(${p.id}, 'cat', this.value)" class="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md outline-none">
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

    // ... [Keep the rest of your original Render/Pending/History code here] ...
    lucide.createIcons();
}

// BACKUP UI FUNCTIONS
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');

window.executeExport = () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `TapMS_Backup.json`; a.click();
    closeBackupModal();
};

window.triggerImport = () => document.getElementById('db-import-input').click();

window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { 
        el.classList.remove('tap-feedback'); 
        void el.offsetWidth; 
        el.classList.add('tap-feedback'); 
    }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.setCategory = (cat) => { currentCat = cat; render(); };

// ... [Keep other helper functions like toggleSummary, checkoutToQueue, approveOrder, etc.] ...
