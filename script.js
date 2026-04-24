let db, products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

function triggerReset() { if(confirm("System Wipe?")) { db.ref('/').set({products:[], queue:[], history:[], orderCounter:0}); location.reload(); }}

async function init() {
    const res = await fetch('/api/config');
    const config = await res.json();
    firebase.initializeApp(config);
    db = firebase.database();
    firebase.auth().onAuthStateChanged(user => {
        if(user) sync();
        else firebase.auth().signInWithEmailAndPassword("admin@gmail.com", "123456");
    });
}

function sync() {
    db.ref('/').on('value', snap => {
        const d = snap.val() || {};
        products = d.products || []; queue = d.queue || []; history = d.history || []; orderCounter = d.orderCounter || 0;
        render();
    });
}

function render() {
    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-count').innerText = cartCount;
    document.getElementById('cart-count').classList.toggle('hidden', cartCount === 0);
    document.getElementById('manage-dot').classList.toggle('hidden', queue.length === 0);

    // Categories
    const cats = ["All", ...new Set(products.map(p => p.category || "General"))];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCat('${c}')" class="px-6 py-2.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    // Cashier (Filtered Search)
    const filtered = products.filter(p => (currentCat === "All" || (p.category || "General") === currentCat) && p.name.toLowerCase().includes(searchTerm));
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div class="item-card bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative" onclick="addToCart(${p.id})">
            ${p.starred ? '<i data-lucide="star" class="absolute top-8 right-8 w-4 h-4 text-amber-400 fill-amber-400 z-10"></i>' : ''}
            <div class="aspect-square mb-4 overflow-hidden ${p.img ? '' : 'img-placeholder'}">
                ${p.img ? `<img src="${p.img}" class="w-full h-full object-cover rounded-[1.8rem]">` : '<i data-lucide="image" class="w-8 h-8 text-slate-300"></i>'}
            </div>
            <h3 class="font-bold text-center text-[11px] truncate uppercase px-1 tracking-tight">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-1">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Orders UI
    const orderHTML = (o, i, hist) => `
        <div class="bg-white p-6 rounded-[2.5rem] border ${hist ? 'border-slate-100' : 'border-blue-100 shadow-sm'} flex justify-between items-center">
            <div>
                <p class="font-black text-xl">#${o.orderNum}</p>
                <p class="text-[9px] font-bold text-slate-400 uppercase mt-0.5">${o.items.length} items • ${o.date}</p>
            </div>
            <div class="flex items-center gap-5">
                <span class="font-black text-blue-600 text-2xl tracking-tighter">$${o.total.toFixed(2)}</span>
                ${hist ? '<i data-lucide="check-circle" class="w-6 h-6 text-slate-200"></i>' : `<button onclick="approve(${i})" class="bg-blue-600 text-white p-3.5 rounded-2xl shadow-lg"><i data-lucide="check" class="w-5 h-5"></i></button>`}
            </div>
        </div>`;

    document.getElementById('list-pending').innerHTML = queue.map((o, i) => orderHTML(o, i, false)).join('');
    document.getElementById('list-history').innerHTML = history.slice(0, 10).map((o, i) => orderHTML(o, i, true)).join('');

    // Stock UI (Star next to Delete)
    document.getElementById('list-stock').innerHTML = products.map(p => `
        <div class="bg-white p-3 rounded-[1.8rem] border border-slate-100 flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl overflow-hidden cursor-pointer ${p.img ? '' : 'img-placeholder'}" onclick="editImg(${p.id})">
                ${p.img ? `<img src="${p.img}" class="w-full h-full object-cover">` : '<i data-lucide="camera" class="w-5 h-5"></i>'}
            </div>
            <div class="flex-1">
                <input onchange="upd(${p.id},'name',this.value)" value="${p.name}" class="block w-full font-bold text-sm bg-transparent outline-none uppercase">
                <input onchange="upd(${p.id},'category',this.value)" value="${p.category || 'General'}" class="text-[9px] font-black text-slate-400 bg-transparent outline-none uppercase">
            </div>
            <div class="flex items-center gap-1">
                <span class="text-blue-600 font-black text-[10px]">$</span>
                <input type="number" onchange="upd(${p.id},'price',this.value)" value="${p.price}" class="w-14 text-right font-black text-xs bg-transparent outline-none text-slate-700">
            </div>
            <div class="flex items-center gap-1 pr-1">
                <button onclick="toggleStar(${p.id})" class="${p.starred ? 'text-amber-400' : 'text-slate-200'} p-1.5 transition-all"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                <button onclick="del(${p.id})" class="text-slate-200 hover:text-red-500 p-1.5"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

window.doSearch = (v) => { searchTerm = v.toLowerCase(); render(); };
window.setCat = (c) => { currentCat = c; render(); };
window.addToCart = (id) => { const p = products.find(x => x.id === id); const ex = cart.find(i => i.id === id); if(ex) ex.qty++; else cart.push({...p, qty:1}); render(); };
window.toggleStar = (id) => { const p = products.find(x => x.id === id); p.starred = !p.starred; save(); };
window.editImg = (id) => { const p = products.find(x => x.id === id); const url = prompt("Image URL:", p.img); if(url !== null) { p.img = url; save(); }};
window.del = (id) => { products = products.filter(x => x.id !== id); save(); };
window.upd = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); save(); };
window.addItem = () => { products.push({id:Date.now(), name:'NEW ITEM', price:0, category:'GENERAL', img:'', starred:false}); save(); };

window.checkout = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, date: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
    queue.unshift(order);
    
    if(summaryEnabled) {
        document.getElementById('sum-total').innerText = `$${total.toFixed(2)}`;
        document.getElementById('sum-id').innerText = `#${orderCounter}`;
        document.getElementById('sum-details').innerHTML = cart.map(i => `<div class="flex justify-between font-bold text-[10px] uppercase"><span>${i.qty}x ${i.name}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('');
        document.getElementById('summary-overlay').classList.add('active');
    }
    cart = []; save();
};

window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('sum-toggle-btn').querySelector('span');
    dot.className = summaryEnabled ? "w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" : "w-2 h-2 rounded-full bg-slate-300";
    label.innerText = `Summary: ${summaryEnabled ? 'ON' : 'OFF'}`;
    label.className = summaryEnabled ? "text-[9px] font-black uppercase text-blue-600" : "text-[9px] font-black uppercase text-slate-500";
};

window.approve = (idx) => { history.unshift(queue.splice(idx, 1)[0]); save(); };
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.save = () => db.ref('/').set({products, queue, history, orderCounter});

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('btn-cashier').className = v === 'cashier' ? 'nav-item active-tab p-5' : 'nav-item text-slate-400 p-5';
    document.getElementById('btn-manage').className = v === 'manage' ? 'nav-item active-tab p-5' : 'nav-item text-slate-400 p-5';
};

window.switchManage = s => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
    document.getElementById('tab-orders').className = s === 'orders' ? 'px-10 py-3 rounded-xl text-[10px] font-black uppercase bg-white text-blue-600 shadow-md' : 'px-10 py-3 rounded-xl text-[10px] font-black uppercase text-slate-500';
    document.getElementById('tab-stock').className = s === 'stock' ? 'px-10 py-3 rounded-xl text-[10px] font-black uppercase bg-white text-blue-600 shadow-md' : 'px-10 py-3 rounded-xl text-[10px] font-black uppercase text-slate-500';
};

init();
