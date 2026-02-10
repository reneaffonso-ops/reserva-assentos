// CONFIGURAÇÃO - Verifique se a URL está correta
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTngB6cIDUnYFLX_vwoXM1OufYfQknlAmUFiUsPi-c4vid7XOq_UmbOEQWNGszQ0TgSi1sZFTHYLC1N/pub?gid=0&single=true&output=csv';

// Configuração dos assentos
const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 6, fileiras: 2 },
    Salao: { baias: 3, assentosPorBaia: 6, fileiras: 2 },
    Gouvea: { baias: 2, assentosPorBaia: 6, fileiras: 2 }
};

// Configuração dos Setores (Chaves devem bater com data-location no HTML)
const departmentsByLocation = {
    'Aquario': ['PTS', 'Centurion', 'BTG'],
    'Salao':   ['CEP', 'Lazer', 'Eventos', 'Supplier', 'ICs'],
    'Gouvea':  ['Financeiro', 'C&P', 'MKT & Com', 'TI', 'Projetos', 'Qualidade']
};

let reservations = [];
let selectedSeat = null;

// Inicializar data
document.getElementById('reservation-date').valueAsDate = new Date();

// Gerar assentos
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
                seat.dataset.id = `${location}-${rowNum}-${i}`;
                
                seat.addEventListener('click', () => selectSeat(seat));
                fileiraDiv.appendChild(seat);
            }
            seatsContainer.appendChild(fileiraDiv);
        }
    });
}

function updateSeatsStatus() {
    const selectedDate = document.getElementById('reservation-date').value;
    
    document.querySelectorAll('.seat').forEach(seat => {
        const seatId = seat.dataset.id;
        const reservation = reservations.find(r => 
            r.data === selectedDate && 
            `${r.local}-${r.baia}-${r.assento}` === seatId
        );
        
        // Reset classes
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

// LÓGICA DO MENU CORRIGIDA
function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Este assento já está ocupado!');
        return;
    }
    
    // Remover seleção visual anterior
    if (selectedSeat) {
        // Volta o anterior para o estado correto (não necessariamente available se ele tiver mudado status)
        selectedSeat.classList.remove('selected');
    }
    
    seat.classList.add('selected');
    selectedSeat = seat;
    
    const locationKey = seat.dataset.location;
    const departmentSelect = document.getElementById('department');
    
    // Limpar e popular Select
    departmentSelect.innerHTML = '<option value="">Selecione seu setor...</option>';
    
    // Debug para garantir que está achando a lista
    console.log('Selecionado:', locationKey);
    console.log('Opções:', departmentsByLocation[locationKey]);

    const options = departmentsByLocation[locationKey];
    if (options && options.length > 0) {
        options.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    } else {
        // Fallback caso não ache
        const option = document.createElement('option');
        option.textContent = "Opções não carregadas";
        departmentSelect.appendChild(option);
    }
    
    // Info do Modal
    const modal = document.getElementById('reservation-modal');
    const displayNames = { 'Aquario': 'Aquário', 'Salao': 'Salão', 'Gouvea': 'Lado Gouvêa' };
    
    document.getElementById('selected-seat').textContent = 
        `${displayNames[locationKey] || locationKey} - Baia ${seat.dataset.row} - Cadeira ${seat.dataset.number}`;
    
    modal.style.display = 'block';
}

// Fechar modal
document.querySelector('.close').addEventListener('click', closeModal);

function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat = null;
    }
}

// Submit
document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const department = document.getElementById('department').value;
    if (!department) {
        alert('Por favor, selecione um setor válido.');
        return;
    }

    const reservation = {
        data: document.getElementById('reservation-date').value,
        nome: document.getElementById('full-name').value,
        setor: department,
        local: selectedSeat.dataset.location,
        baia: selectedSeat.dataset.row,
        assento: selectedSeat.dataset.number,
        timestamp: new Date().toISOString()
    };
    
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Salvando...';
    btn.disabled = true;
    
    if (await saveReservation(reservation)) {
        reservations.push(reservation);
        updateSeatsStatus();
        document.getElementById('reservation-modal').style.display = 'none';
        document.getElementById('reservation-form').reset();
        selectedSeat = null;
        alert('Reserva realizada!');
    } else {
        alert('Erro ao salvar. Tente novamente.');
    }
    
    btn.textContent = originalText;
    btn.disabled = false;
});

async function saveReservation(reservation) {
    try {
        const formData = new FormData();
        Object.keys(reservation).forEach(key => formData.append(key, reservation[key]));
        
        await fetch(SCRIPT_URL, { method: 'POST', body: formData, redirect: 'follow' });
        await new Promise(r => setTimeout(r, 1000)); // Delay segurança
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function loadReservations() {
    try {
        const res = await fetch(SHEET_CSV_URL + '&t=' + Date.now());
        const txt = await res.text();
        const rows = txt.split('\n').slice(1);
        
        reservations = rows.map(r => {
            const c = r.split(',');
            return { data: c[0], nome: c[1], setor: c[2], local: c[3], baia: c[4], assento: c[5] };
        }).filter(r => r.data);
        
        updateSeatsStatus();
    } catch (e) { console.error(e); }
}

document.getElementById('reservation-date').addEventListener('change', updateSeatsStatus);
setInterval(loadReservations, 30000);
generateSeats();
loadReservations();
