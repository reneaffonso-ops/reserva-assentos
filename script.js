// CONFIGURAÇÃO
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTngB6cIDUnYFLX_vwoXM1OufYfQknlAmUFiUsPi-c4vid7XOq_UmbOEQWNGszQ0TgSi1sZFTHYLC1N/pub?gid=0&single=true&output=csv';

// Estrutura do Escritório
const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 6, fileiras: 2 },
    Salao: { baias: 3, assentosPorBaia: 6, fileiras: 2 },
    Gouvea: { baias: 2, assentosPorBaia: 6, fileiras: 2 }
};

const departmentsByLocation = {
    'Aquario': ['PTS', 'Centurion', 'BTG'],
    'Salao':   ['CEP', 'Lazer', 'Eventos', 'Supplier', 'ICs'],
    'Gouvea':  ['Financeiro', 'C&P', 'MKT & Com', 'TI', 'Projetos', 'Qualidade']
};

let allReservations = [];
let selectedSeat = null;

// Inicialização
window.onload = function() {
    document.getElementById('reservation-date').valueAsDate = new Date();
    generateSeats();
    loadReservations();
    
    // Atualização automática a cada 15 segundos
    setInterval(loadReservations, 15000);
};

// Eventos
document.getElementById('reservation-date').addEventListener('change', updateSeatsStatus);
document.querySelector('.close').addEventListener('click', closeModal);

// --- FUNÇÕES DE AJUDA (CRÍTICAS PARA CORRIGIR O BUG) ---

// Normaliza datas para YYYY-MM-DD (Padrão ISO)
// Resolve o problema de 10/02/2026 vs 2026-02-10
function normalizeDate(dateStr) {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim();
    
    // Se já for YYYY-MM-DD
    if (cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) return cleanStr;
    
    // Se for DD/MM/YYYY (Padrão BR)
    const brMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
        // Retorna YYYY-MM-DD (com zeros à esquerda se necessário)
        return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
    }
    
    return cleanStr; // Retorna original se não reconhecer
}

// Normaliza strings para comparação (remove espaços e força texto)
function safeStr(val) {
    return val ? String(val).trim() : '';
}

// --- LÓGICA PRINCIPAL ---

function generateSeats() {
    document.querySelectorAll('.row').forEach(row => {
        const location = row.dataset.location;
        const rowNum = parseInt(row.dataset.row);
        const seatsContainer = row.querySelector('.seats');
        const config = seatingConfig[location];
        
        seatsContainer.innerHTML = '';
        
        for (let fileira = 1; fileira <= config.fileiras; fileira++) {
            const fileiraDiv = document.createElement('div');
            fileiraDiv.className = 'seat-row';
            
            const startNum = (fileira - 1) * config.assentosPorBaia + 1;
            const endNum = fileira * config.assentosPorBaia;
            
            for (let i = startNum; i <= endNum; i++) {
                const seat = document.createElement('div');
                seat.className = 'seat available';
                seat.textContent = i;
                seat.dataset.location = location;
                seat.dataset.row = rowNum;
                seat.dataset.number = i;
                // ID ÚNICO: location-baia-assento
                seat.dataset.id = `${location}-${rowNum}-${i}`;
                
                seat.addEventListener('click', () => selectSeat(seat));
                fileiraDiv.appendChild(seat);
            }
            seatsContainer.appendChild(fileiraDiv);
        }
    });
}

function updateSeatsStatus() {
    const selectedDate = document.getElementById('reservation-date').value; // Formato YYYY-MM-DD
    
    document.querySelectorAll('.seat').forEach(seat => {
        const seatId = seat.dataset.id; // Formato: Local-Baia-Assento
        
        // Busca reserva compatível
        const reservation = allReservations.find(r => {
            // Compara Data (Normalizada)
            const dateMatch = normalizeDate(r.data) === selectedDate;
            // Compara ID (Montado de forma segura)
            const idMatch = `${safeStr(r.local)}-${safeStr(r.baia)}-${safeStr(r.assento)}` === seatId;
            return dateMatch && idMatch;
        });
        
        // Reset Visual
        seat.className = 'seat';
        
        if (reservation) {
            seat.classList.add('occupied');
            // Tooltip com nome
            seat.title = `${reservation.nome} (${reservation.setor})`;
        } else {
            seat.classList.add('available');
            seat.title = 'Livre';
        }
        
        // Se for o selecionado no momento, mantém azul
        if (selectedSeat && seat === selectedSeat) {
            seat.classList.remove('available');
            seat.classList.add('selected');
        }
    });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert(`Ocupado por: ${seat.title}`);
        return;
    }
    
    // Remove seleção anterior
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
    }
    
    seat.classList.remove('available');
    seat.classList.add('selected');
    selectedSeat = seat;
    
    // Configura Menu
    const location = seat.dataset.location;
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">Selecione...</option>';
    
    const options = departmentsByLocation[location] || [];
    options.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt;
        deptSelect.appendChild(el);
    });
    
    // Abre Modal
    const displayNames = { 'Aquario': 'Aquário', 'Salao': 'Salão', 'Gouvea': 'Lado Gouvêa' };
    document.getElementById('selected-seat').textContent = 
        `${displayNames[location]} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
    document.getElementById('reservation-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
        selectedSeat = null;
    }
}

// --- ENVIO E SALVAMENTO ---

document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedSeat) return;

    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Reservando...';
    btn.disabled = true;

    try {
        const newRes = {
            data: document.getElementById('reservation-date').value,
            nome: document.getElementById('full-name').value,
            setor: document.getElementById('department').value,
            local: selectedSeat.dataset.location,
            baia: selectedSeat.dataset.row,
            assento: selectedSeat.dataset.number,
            timestamp: new Date().toISOString()
        };

        if (!newRes.setor) throw new Error('Selecione um setor');

        // 1. Salvar Localmente PRIMEIRO (Feedback Imediato)
        saveLocalReservation(newRes);
        
        // 2. Atualizar a tela imediatamente (Ocupar o lugar)
        // Isso força o botão a ficar vermelho instantaneamente
        loadReservations(); 

        // 3. Enviar para Google Sheets (Background)
        const formData = new FormData();
        Object.keys(newRes).forEach(k => formData.append(k, newRes[k]));
        
        await fetch(SCRIPT_URL, { method: 'POST', body: formData, redirect: 'follow' });
        
        // Sucesso
        alert('Reserva Realizada com Sucesso!');
        document.getElementById('reservation-modal').style.display = 'none';
        document.getElementById('reservation-form').reset();
        selectedSeat = null;

    } catch (error) {
        console.error(error);
        alert('Erro ao conectar. A reserva foi salva localmente e será sincronizada.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// --- SISTEMA INTELIGENTE DE CACHE ---

function saveLocalReservation(res) {
    const local = JSON.parse(localStorage.getItem('office_reservations') || '[]');
    local.push(res);
    localStorage.setItem('office_reservations', JSON.stringify(local));
}

async function loadReservations() {
    try {
        // 1. Dados Locais (Meus)
        const localData = JSON.parse(localStorage.getItem('office_reservations') || '[]');

        // 2. Dados do Servidor (Todos)
        let serverData = [];
        try {
            const res = await fetch(SHEET_CSV_URL + '&t=' + Date.now());
            if (res.ok) {
                const txt = await res.text();
                const rows = txt.split('\n').slice(1);
                serverData = rows.map(r => {
                    const c = r.split(',');
                    // Garante que leu as colunas certas, incluindo BAIA na posição 4 (índice 4 = coluna E)
                    // Colunas: Data(0), Nome(1), Setor(2), Local(3), Baia(4), Assento(5)
                    if (c.length < 6) return null;
                    return {
                        data: normalizeDate(c[0]), // NORMALIZA A DATA AQUI
                        nome: c[1],
                        setor: c[2],
                        local: safeStr(c[3]),
                        baia: safeStr(c[4]),
                        assento: safeStr(c[5])
                    };
                }).filter(x => x);
            }
        } catch (err) {
            console.warn('Servidor offline ou delay, usando cache local');
        }

        // 3. Mesclagem Inteligente
        // Mantemos os locais APENAS se eles ainda não apareceram no servidor
        const pendingLocal = localData.filter(localItem => {
            const isOnServer = serverData.some(serverItem => 
                serverItem.data === localItem.data &&
                serverItem.local === safeStr(localItem.local) &&
                serverItem.baia === safeStr(localItem.baia) &&
                serverItem.assento === safeStr(localItem.assento)
            );
            return !isOnServer; // Se já está no servidor, remove do local
        });

        // Atualiza cache limpo
        localStorage.setItem('office_reservations', JSON.stringify(pendingLocal));

        // Lista Final para exibição
        allReservations = [...serverData, ...pendingLocal];
        
        updateSeatsStatus();

    } catch (e) {
        console.error(e);
    }
}