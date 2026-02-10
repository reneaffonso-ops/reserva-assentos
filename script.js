// CONFIGURAÇÃO - Mantenha suas URLs aqui
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTngB6cIDUnYFLX_vwoXM1OufYfQknlAmUFiUsPi-c4vid7XOq_UmbOEQWNGszQ0TgSi1sZFTHYLC1N/pub?gid=0&single=true&output=csv';

// Configurações
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

let allReservations = []; // Lista combinada (Servidor + Local)
let selectedSeat = null;

// Inicializar
document.getElementById('reservation-date').valueAsDate = new Date();
generateSeats();
loadReservations();

// Eventos
document.getElementById('reservation-date').addEventListener('change', updateSeatsStatus);
document.querySelector('.close').addEventListener('click', closeModal);
setInterval(loadReservations, 30000); // Atualiza a cada 30s

// Gerar layout visual
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
                // ID Único para comparação
                seat.dataset.id = `${location}-${rowNum}-${i}`;
                
                seat.addEventListener('click', () => selectSeat(seat));
                fileiraDiv.appendChild(seat);
            }
            seatsContainer.appendChild(fileiraDiv);
        }
    });
}

// Atualizar cores dos assentos
function updateSeatsStatus() {
    const selectedDate = document.getElementById('reservation-date').value;
    
    document.querySelectorAll('.seat').forEach(seat => {
        const seatId = seat.dataset.id;
        
        // Procura se existe reserva para esta Data E este Assento
        const reservation = allReservations.find(r => 
            r.data === selectedDate && 
            `${r.local}-${r.baia}-${r.assento}` === seatId
        );
        
        // Reset básico
        seat.className = 'seat';
        
        if (reservation) {
            seat.classList.add('occupied');
            seat.title = `${reservation.nome} - ${reservation.setor}`;
        } else {
            seat.classList.add('available');
            seat.title = 'Livre';
        }
    });
}

// Lógica de Seleção
function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Assento ocupado por: ' + seat.title);
        return;
    }
    
    if (selectedSeat) selectedSeat.classList.remove('selected');
    
    seat.classList.add('selected');
    selectedSeat = seat;
    
    // Configurar Menu
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
    
    // Configurar Modal
    const displayNames = { 'Aquario': 'Aquário', 'Salao': 'Salão', 'Gouvea': 'Lado Gouvêa' };
    document.getElementById('selected-seat').textContent = 
        `${displayNames[location]} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
        
    document.getElementById('reservation-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat = null;
    }
}

// Envio do Formulário
document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Salvando...';
    btn.disabled = true;

    try {
        const newReservation = {
            data: document.getElementById('reservation-date').value,
            nome: document.getElementById('full-name').value,
            setor: document.getElementById('department').value,
            local: selectedSeat.dataset.location,
            baia: selectedSeat.dataset.row,
            assento: selectedSeat.dataset.number,
            timestamp: new Date().toISOString()
        };

        if (!newReservation.setor) throw new Error('Selecione um setor');

        // 1. Salvar no Google Sheets
        const formData = new FormData();
        Object.keys(newReservation).forEach(k => formData.append(k, newReservation[k]));
        
        await fetch(SCRIPT_URL, { method: 'POST', body: formData, redirect: 'follow' }); // Removed mode: 'no-cors' to verify status if possible, but 'follow' is safer for GAS redirects.

        // 2. Salvar Localmente (Cache Temporário)
        saveLocalReservation(newReservation);
        
        // 3. Atualizar Visual
        alert('Reserva Confirmada!');
        closeModal();
        document.getElementById('reservation-form').reset();
        
        // Força recarga combinando dados
        loadReservations();

    } catch (error) {
        console.error(error);
        alert('Erro ao salvar. Tente novamente.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// --- SISTEMA DE CACHE E CARREGAMENTO ---

// Salva no localStorage para persistência imediata
function saveLocalReservation(res) {
    const localData = JSON.parse(localStorage.getItem('my_reservations') || '[]');
    localData.push(res);
    localStorage.setItem('my_reservations', JSON.stringify(localData));
}

// Carrega dados do servidor (CSV) e mistura com local
async function loadReservations() {
    try {
        // 1. Buscar CSV do Servidor
        const response = await fetch(SHEET_CSV_URL + '&t=' + Date.now());
        const text = await response.text();
        const rows = text.split('\n').slice(1); // Pular cabeçalho
        
        const serverReservations = rows.map(row => {
            const c = row.split(',');
            if (c.length < 6) return null;
            return {
                data: c[0],
                nome: c[1],
                setor: c[2],
                local: c[3],
                baia: c[4],     // Agora estamos lendo a Baia explicitamente
                assento: c[5]
            };
        }).filter(r => r && r.data);

        // 2. Buscar Dados Locais (O que acabamos de salvar)
        const localData = JSON.parse(localStorage.getItem('my_reservations') || '[]');
        
        // 3. Combinar Listas (Prioridade para o Local se o servidor estiver atrasado)
        // Se a reserva já estiver no servidor, removemos do local para limpar o cache
        const cleanLocalData = localData.filter(localRes => {
            const existsOnServer = serverReservations.some(serverRes => 
                serverRes.data === localRes.data &&
                serverRes.local === localRes.local &&
                serverRes.baia === localRes.baia &&
                serverRes.assento === localRes.assento
            );
            return !existsOnServer; // Mantém no local APENAS se ainda não apareceu no servidor
        });

        // Atualiza o localStorage limpo
        localStorage.setItem('my_reservations', JSON.stringify(cleanLocalData));

        // Lista Final = Servidor + Local (que ainda não caiu no servidor)
        allReservations = [...serverReservations, ...cleanLocalData];
        
        updateSeatsStatus();
        
    } catch (error) {
        console.error("Erro ao atualizar:", error);
    }
}
