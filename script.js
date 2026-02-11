// --- CONFIGURAÇÃO ---
// COLAR AQUI A NOVA URL GERADA NA IMPLANTAÇÃO "V2"
const API_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec'; 

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

// --- INICIALIZAÇÃO ---
window.onload = function() {
    // CORREÇÃO DA DATA (Usa hora local, não UTC)
    const today = new Date();
    const localISO = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('reservation-date').value = localISO;

    generateSeats();
    fetchReservations(); // Busca inicial
    setInterval(fetchReservations, 4000); // Polling a cada 4s
};

// --- EVENTOS ---
document.getElementById('reservation-date').addEventListener('change', () => {
    updateSeatsStatus();
    fetchReservations();
});
document.querySelector('.close').addEventListener('click', closeModal);

// --- API ---
async function fetchReservations() {
    try {
        // Adiciona timestamp para evitar cache do navegador
        const response = await fetch(`${API_URL}?t=${new Date().getTime()}`, { redirect: 'follow' });
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allReservations = data;
            updateSeatsStatus();
        }
    } catch (error) {
        console.error("Erro sync:", error);
    }
}

// --- VISUAL ---
function generateSeats() {
    document.querySelectorAll('.row').forEach(row => {
        const location = row.dataset.location;
        const rowNum = row.dataset.row;
        const container = row.querySelector('.seats');
        const config = seatingConfig[location];
        
        container.innerHTML = '';
        
        for (let f = 1; f <= config.fileiras; f++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'seat-row';
            const start = (f - 1) * config.assentosPorBaia + 1;
            const end = f * config.assentosPorBaia;
            
            for (let i = start; i <= end; i++) {
                const seat = document.createElement('div');
                seat.className = 'seat available';
                seat.textContent = i;
                seat.dataset.location = location;
                seat.dataset.row = rowNum;
                seat.dataset.number = i;
                seat.dataset.id = `${location}-${rowNum}-${i}`;
                seat.onclick = () => selectSeat(seat);
                rowDiv.appendChild(seat);
            }
            container.appendChild(rowDiv);
        }
    });
}

function updateSeatsStatus() {
    const selectedDate = document.getElementById('reservation-date').value;
    
    document.querySelectorAll('.seat').forEach(seat => {
        const seatId = seat.dataset.id;
        
        // Comparação estrita de strings
        const reservation = allReservations.find(r => 
            r.data === selectedDate && 
            String(r.local) === String(seat.dataset.location) &&
            String(r.baia) === String(seat.dataset.row) &&
            String(r.assento) === String(seat.dataset.number)
        );
        
        // Limpa estado visual anterior (exceto se for o selecionado pelo usuário atual)
        const isSelected = selectedSeat === seat;
        seat.className = isSelected ? 'seat selected' : 'seat available';
        seat.title = 'Livre';
        
        if (reservation) {
            seat.className = 'seat occupied';
            seat.title = `${reservation.nome} (${reservation.setor})`;
            
            // Se estava selecionado e ficou ocupado na sync
            if (isSelected) {
                closeModal();
                alert(`O assento ${seat.textContent} foi ocupado por ${reservation.nome}.`);
                selectedSeat = null;
            }
        }
    });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Lugar ocupado: ' + seat.title);
        return;
    }
    
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
    }
    
    seat.classList.remove('available');
    seat.classList.add('selected');
    selectedSeat = seat;
    
    // Menu Setor
    const sel = document.getElementById('department');
    sel.innerHTML = '<option value="">Selecione...</option>';
    (departmentsByLocation[seat.dataset.location] || []).forEach(d => {
        sel.innerHTML += `<option value="${d}">${d}</option>`;
    });
    
    document.getElementById('selected-seat').textContent = 
        `${seat.dataset.location} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
    document.getElementById('reservation-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
        selectedSeat = null;
    }
    document.getElementById('reservation-form').reset();
}

// --- ENVIO ---
document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSeat) return;

    const btn = e.target.querySelector('button');
    const txt = btn.textContent;
    btn.textContent = 'Processando...';
    btn.disabled = true;

    const fd = new FormData();
    fd.append('data', document.getElementById('reservation-date').value);
    fd.append('nome', document.getElementById('full-name').value);
    fd.append('setor', document.getElementById('department').value);
    fd.append('local', selectedSeat.dataset.location);
    fd.append('baia', selectedSeat.dataset.row);
    fd.append('assento', selectedSeat.dataset.number);

    try {
        const res = await fetch(API_URL, { method: 'POST', body: fd });
        const json = await res.json();

        if (json.success) {
            alert('Sucesso!');
            closeModal();
            fetchReservations(); // Atualiza Imediatamente
        } else if (json.error === 'DUPLICATE') {
            alert(`ERRO: Lugar já reservado!\n${json.message}`);
            closeModal();
            fetchReservations(); // Atualiza para mostrar o ocupante
        } else {
            alert('Erro: ' + json.error);
        }
    } catch (err) {
        alert('Erro de conexão.');
    } finally {
        btn.textContent = txt;
        btn.disabled = false;
    }
});
