// CONFIGURAÇÃO - Substitua pela URL do seu Google Sheet publicado como CSV
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTngB6cIDUnYFLX_vwoXM1OufYfQknlAmUFiUsPi-c4vid7XOq_UmbOEQWNGszQ0TgSi1sZFTHYLC1N/pub?gid=0&single=true&output=csv';

// Configuração dos assentos
const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 12 },
    Salao: { baias: 3, assentosPorBaia: 12 },
    Gouvea: { baias: 2, assentosPorBaia: 12 }
};

let reservations = [];
let selectedSeat = null;

// Inicializar a data de hoje
document.getElementById('reservation-date').valueAsDate = new Date();

// Gerar assentos
function generateSeats() {
    document.querySelectorAll('.row').forEach(row => {
        const location = row.dataset.location;
        const rowNum = row.dataset.row;
        const seatsContainer = row.querySelector('.seats');
        const config = seatingConfig[location];
        
        for (let i = 1; i <= config.assentosPorBaia; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat available';
            seat.textContent = i;
            seat.dataset.location = location;
            seat.dataset.row = rowNum;
            seat.dataset.number = i;
            seat.dataset.id = `${location}-${rowNum}-${i}`;
            
            seat.addEventListener('click', () => selectSeat(seat));
            seatsContainer.appendChild(seat);
        }
    });
}

// Atualizar status dos assentos baseado na data selecionada
function updateSeatsStatus() {
    const selectedDate = document.getElementById('reservation-date').value;
    
    document.querySelectorAll('.seat').forEach(seat => {
        const seatId = seat.dataset.id;
        const isReserved = reservations.some(r => 
            r.data === selectedDate && 
            `${r.local}-${r.baia}-${r.assento}` === seatId
        );
        
        if (isReserved) {
            seat.className = 'seat occupied';
        } else {
            seat.className = 'seat available';
        }
    });
}

// Selecionar assento
function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Este assento já está ocupado!');
        return;
    }
    
    // Remover seleção anterior
    document.querySelectorAll('.seat.selected').forEach(s => {
        if (s.classList.contains('occupied')) {
            s.className = 'seat occupied';
        } else {
            s.className = 'seat available';
        }
    });
    
    // Selecionar novo assento
    seat.classList.add('selected');
    selectedSeat = seat;
    
    // Mostrar modal
    const modal = document.getElementById('reservation-modal');
    const seatInfo = `${seat.dataset.location} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
    document.getElementById('selected-seat').textContent = seatInfo;
    modal.style.display = 'block';
}

// Fechar modal
document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.className = 'seat available';
        selectedSeat = null;
    }
});

// Submeter reserva
document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('reservation-date').value;
    const name = document.getElementById('full-name').value;
    const department = document.getElementById('department').value;
    
    const reservation = {
        data: date,
        nome: name,
        setor: department,
        local: selectedSeat.dataset.location,
        baia: selectedSeat.dataset.row,
        assento: selectedSeat.dataset.number,
        timestamp: new Date().toISOString()
    };
    
    // Salvar no Google Sheets
    await saveReservation(reservation);
    
    // Atualizar localmente
    reservations.push(reservation);
    updateSeatsStatus();
    
    // Fechar modal e limpar formulário
    document.getElementById('reservation-modal').style.display = 'none';
    document.getElementById('reservation-form').reset();
    selectedSeat = null;
    
    alert('Reserva confirmada com sucesso!');
});

// Salvar reserva no Google Sheets
async function saveReservation(reservation) {
    const scriptURL = 'https://script.google.com/macros/s/AKfycbzEw6I2bALMsty6WXsSvY_7zcF8F9_f6dQSEyZz23S_5iJbwCD4suims_OWPy6o5cIdrg/exec';
    
    try {
        await fetch(scriptURL, {
            method: 'POST',
            body: JSON.stringify(reservation)
        });
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar reserva. Tente novamente.');
    }
}

// Carregar reservas do Google Sheets
async function loadReservations() {
    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        const rows = text.split('\n').slice(1); // Remove cabeçalho
        
        reservations = rows.map(row => {
            const [data, nome, setor, local, baia, assento] = row.split(',');
            return { data, nome, setor, local, baia, assento };
        }).filter(r => r.data); // Remove linhas vazias
        
        updateSeatsStatus();
    } catch (error) {
        console.error('Erro ao carregar reservas:', error);
    }
}

// Event listener para mudança de data
document.getElementById('reservation-date').addEventListener('change', updateSeatsStatus);

// Inicializar
generateSeats();
loadReservations();
