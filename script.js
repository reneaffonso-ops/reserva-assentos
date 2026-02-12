// CONFIGURAÇÃO: Insira sua URL NOVA AQUI
const API_URL = 'SUA_NOVA_URL_DO_APPS_SCRIPT_AQUI'; 

// Capacidades Totais (Hardcoded para cálculo rápido da barra, mas pode vir do config também)
const CAPACITIES = { Aquario: 48, Salao: 36, Gouvea: 24 };
const TOTAL_SEATS = 48 + 36 + 24;

const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 6, fileiras: 2 },
    Salao:   { baias: 3, assentosPorBaia: 6, fileiras: 2 },
    Gouvea:  { baias: 2, assentosPorBaia: 6, fileiras: 2 }
};

let allReservations = [];
let departmentRules = []; // Virá do Excel (Aba Config)
let selectedSeat = null;

window.onload = function() {
    setupDateRestrictions();
    generateSeats();
    fetchData(); // Busca única de dados + config
    setInterval(fetchData, 8000); // Refresh a cada 8s
};

// 1. RESTRITO À SEMANA VIGENTE
function setupDateRestrictions() {
    const today = new Date();
    const currentDay = today.getDay(); // 0=Dom, 6=Sab
    
    // Calcular Domingo (Início) e Sábado (Fim)
    const start = new Date(today);
    start.setDate(today.getDate() - currentDay);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const dateInput = document.getElementById('reservation-date');
    
    // Define Min e Max no Input HTML
    dateInput.min = start.toISOString().split('T')[0];
    dateInput.max = end.toISOString().split('T')[0];
    
    // Valor inicial = Hoje (se dentro da semana) ou ajusta
    const localToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localToday;
    
    document.getElementById('week-range-text').textContent = 
        `Semana vigente: ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`;
}

// 2. BUSCA UNIFICADA (Reservas + Config)
async function fetchData() {
    try {
        const res = await fetch(`${API_URL}?t=${new Date().getTime()}`, { redirect: 'follow' });
        const json = await res.json();
        
        if (json.reservations) allReservations = json.reservations;
        if (json.config) departmentRules = json.config;
        
        updateVisuals();
    } catch (e) { console.error("Sync error:", e); }
}

function updateVisuals() {
    updateSeatsStatus();
    updateOccupancyBar();
    renderDashboard();
}

// 3. ATUALIZA BARRA DE OCUPAÇÃO (Barra Colorida)
function updateOccupancyBar() {
    const date = document.getElementById('reservation-date').value;
    // Filtra reservas do dia
    const dayRes = allReservations.filter(r => r.data === date);
    
    // Contagem por área
    const counts = { Aquario: 0, Salao: 0, Gouvea: 0 };
    dayRes.forEach(r => { if(counts[r.local] !== undefined) counts[r.local]++; });
    
    // Cálculos de % em relação ao TOTAL GERAL (para a barra empilhada)
    const pctAquario = (counts.Aquario / TOTAL_SEATS) * 100;
    const pctSalao = (counts.Salao / TOTAL_SEATS) * 100;
    const pctGouvea = (counts.Gouvea / TOTAL_SEATS) * 100;
    const totalPct = ((dayRes.length / TOTAL_SEATS) * 100).toFixed(1);

    // Atualiza CSS
    document.getElementById('prog-aquario').style.width = `${pctAquario}%`;
    document.getElementById('prog-salao').style.width = `${pctSalao}%`;
    document.getElementById('prog-gouvea').style.width = `${pctGouvea}%`;
    
    // Atualiza Tooltips Individuais (Exibe % relativo à capacidade daquela sala)
    const realPctAq = Math.round((counts.Aquario / CAPACITIES.Aquario) * 100);
    const realPctSa = Math.round((counts.Salao / CAPACITIES.Salao) * 100);
    const realPctGo = Math.round((counts.Gouvea / CAPACITIES.Gouvea) * 100);
    
    document.querySelector('#prog-aquario .tooltip').textContent = `Aquário: ${counts.Aquario}/${CAPACITIES.Aquario} (${realPctAq}%)`;
    document.querySelector('#prog-salao .tooltip').textContent = `Salão: ${counts.Salao}/${CAPACITIES.Salao} (${realPctSa}%)`;
    document.querySelector('#prog-gouvea .tooltip').textContent = `Gouvêa: ${counts.Gouvea}/${CAPACITIES.Gouvea} (${realPctGo}%)`;
    
    document.getElementById('total-percent').textContent = `Total Dia: ${totalPct}%`;
}

// 4. RENDERIZA DASHBOARD (Cards)
function renderDashboard() {
    const container = document.getElementById('dashboard-cards');
    if(departmentRules.length === 0) return;
    
    const date = document.getElementById('reservation-date').value;
    const dayRes = allReservations.filter(r => r.data === date);
    
    container.innerHTML = '';
    
    departmentRules.forEach(rule => {
        // Conta quantos deste setor já reservaram hoje
        const occupied = dayRes.filter(r => r.setor === rule.area).length;
        const total = rule.slots;
        const available = total - occupied;
        
        // Cor dinâmica: Vermelho se lotado, Verde se livre
        const statusColor = available <= 0 ? '#e74c3c' : '#27ae60';
        
        const card = document.createElement('div');
        card.className = 'dash-card';
        card.innerHTML = `
            <div class="card-title">${rule.area}</div>
            <div class="card-slots" style="color:${statusColor}">${occupied}/${total}</div>
            <div class="card-sub">Ocupados</div>
            <div class="card-days">${rule.dias}</div>
        `;
        container.appendChild(card);
    });
}

// --- FUNÇÕES DE MAPA (Mantidas e Ajustadas) ---
document.getElementById('reservation-date').addEventListener('change', () => {
    updateVisuals();
    fetchData();
});

function generateSeats() {
    document.querySelectorAll('.row').forEach(row => {
        const loc = row.dataset.location;
        const rNum = row.dataset.row;
        const cont = row.querySelector('.seats');
        const cfg = seatingConfig[loc];
        cont.innerHTML = '';
        
        for (let f=1; f<=cfg.fileiras; f++) {
            const d = document.createElement('div'); d.className = 'seat-row';
            const s = (f-1)*cfg.assentosPorBaia+1; const e = f*cfg.assentosPorBaia;
            for(let i=s; i<=e; i++) {
                const seat = document.createElement('div');
                seat.className = 'seat available';
                seat.textContent = i;
                seat.dataset.id = `${loc}-${rNum}-${i}`;
                seat.dataset.loc = loc; seat.dataset.row = rNum; seat.dataset.num = i;
                seat.onclick = () => selectSeat(seat);
                d.appendChild(seat);
            }
            cont.appendChild(d);
        }
    });
}

function updateSeatsStatus() {
    const date = document.getElementById('reservation-date').value;
    document.querySelectorAll('.seat').forEach(seat => {
        const r = allReservations.find(res => 
            res.data === date && 
            String(res.local) === seat.dataset.loc && 
            String(res.baia) === seat.dataset.row && 
            String(res.assento) === seat.dataset.num
        );
        
        const isSel = selectedSeat === seat;
        seat.className = isSel ? 'seat selected' : 'seat available';
        seat.title = 'Livre';
        
        if (r) {
            seat.className = 'seat occupied';
            seat.title = `${r.nome} (${r.setor})`;
            if (isSel) {
                closeModal();
                alert(`Ocupado por ${r.nome}`);
                selectedSeat = null;
            }
        }
    });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied')) return alert('Ocupado!');
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
    }
    seat.classList.add('selected'); seat.classList.remove('available');
    selectedSeat = seat;
    
    // Popula Select baseado no Config do Excel
    const sel = document.getElementById('department');
    sel.innerHTML = '<option value="">Selecione...</option>';
    departmentRules.forEach(r => {
        sel.innerHTML += `<option value="${r.area}">${r.area}</option>`;
    });
    
    document.getElementById('selected-seat').textContent = `${seat.dataset.loc} - Baia ${seat.dataset.row} - ${seat.dataset.num}`;
    document.getElementById('reservation-modal').style.display = 'block';
}

document.querySelector('.close').addEventListener('click', closeModal);
function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if(selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
        selectedSeat = null;
    }
}

document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!selectedSeat) return;
    
    const btn = e.target.querySelector('button');
    btn.textContent = 'Enviando...'; btn.disabled = true;
    
    const fd = new FormData();
    fd.append('data', document.getElementById('reservation-date').value);
    fd.append('nome', document.getElementById('full-name').value);
    fd.append('setor', document.getElementById('department').value);
    fd.append('local', selectedSeat.dataset.loc);
    fd.append('baia', selectedSeat.dataset.row);
    fd.append('assento', selectedSeat.dataset.num);
    
    try {
        const res = await fetch(API_URL, {method: 'POST', body: fd});
        const json = await res.json();
        if(json.success) {
            alert('Reserva OK!'); closeModal(); fetchData();
        } else {
            alert('Erro: ' + (json.message || json.error));
            if(json.error === 'DUPLICATE') fetchData();
        }
    } catch(err) { alert('Erro conexão'); }
    finally { btn.textContent = 'Confirmar'; btn.disabled = false; }
});
