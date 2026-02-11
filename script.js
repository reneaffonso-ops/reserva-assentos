// NOVA LÓGICA - TEMPO REAL
// Cole aqui a URL NOVA do seu Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec'; 

// (Mantenha as configs de layout iguais...)
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

window.onload = function() {
    document.getElementById('reservation-date').valueAsDate = new Date();
    generateSeats();
    
    // Carregamento Inicial
    fetchReservations();
    
    // Polling mais rápido (a cada 5s) porque agora é API direta e leve
    setInterval(fetchReservations, 5000);
};

document.getElementById('reservation-date').addEventListener('change', () => {
    updateSeatsStatus(); // Atualiza visual imediato
    fetchReservations(); // Busca dados novos da nova data
});

document.querySelector('.close').addEventListener('click', closeModal);

// --- NOVA FUNÇÃO DE BUSCA (GET) ---
async function fetchReservations() {
    try {
        // Chama o doGet do Apps Script
        const response = await fetch(API_URL, { redirect: 'follow' });
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allReservations = data;
            updateSeatsStatus();
        }
    } catch (error) {
        console.error("Erro de sincronização:", error);
    }
}

// --- FUNÇÕES VISUAIS (IGUAIS) ---
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
        
        // A API já devolve a data formatada YYYY-MM-DD, comparação direta e segura
        const reservation = allReservations.find(r => 
            r.data === selectedDate && 
            `${r.local}-${r.baia}-${r.assento}` === seatId
        );
        
        seat.className = 'seat'; // Reset
        
        if (reservation) {
            seat.classList.add('occupied');
            seat.title = `${reservation.nome} (${reservation.setor})`;
            
            // Se eu tinha selecionado este, mas ele ficou ocupado agora
            if (selectedSeat && selectedSeat === seat) {
                closeModal();
                alert(`O assento ${seat.textContent} acabou de ser ocupado por ${reservation.nome}!`);
                selectedSeat = null;
            }
        } else {
            seat.classList.add('available');
            seat.title = 'Livre';
        }
        
        if (selectedSeat && seat === selectedSeat) {
            seat.classList.remove('available');
            seat.classList.add('selected');
        }
    });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Este assento já está reservado.');
        return;
    }
    if (selectedSeat) selectedSeat.classList.remove('selected');
    
    seat.classList.add('selected');
    selectedSeat = seat;
    
    // Popula Menu
    const location = seat.dataset.location;
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">Selecione...</option>';
    (departmentsByLocation[location] || []).forEach(d => {
        deptSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });
    
    document.getElementById('selected-seat').textContent = 
        `${location} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
    document.getElementById('reservation-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat = null;
    }
}

// --- ENVIO SEGURO (POST) ---
document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Verificando disponibilidade...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('data', document.getElementById('reservation-date').value);
    formData.append('nome', document.getElementById('full-name').value);
    formData.append('setor', document.getElementById('department').value);
    formData.append('local', selectedSeat.dataset.location);
    formData.append('baia', selectedSeat.dataset.row);
    formData.append('assento', selectedSeat.dataset.number);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Reserva Confirmada com Sucesso!');
            closeModal();
            document.getElementById('reservation-form').reset();
            fetchReservations(); // Atualiza tudo na hora
        } else if (result.error === 'DUPLICATE') {
            alert(result.message); // "Este lugar acabou de ser reservado!"
            fetchReservations(); // Atualiza para mostrar o novo ocupante
            closeModal();
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        alert('Erro ao reservar: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});
