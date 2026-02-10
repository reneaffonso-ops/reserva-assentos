// CONFIGURAÇÃO - Substitua pela URL do Google Apps Script Web App
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTngB6cIDUnYFLX_vwoXM1OufYfQknlAmUFiUsPi-c4vid7XOq_UmbOEQWNGszQ0TgSi1sZFTHYLC1N/pub?gid=0&single=true&output=csv';

// Configuração dos assentos
const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 6, fileiras: 2 },
    Salao: { baias: 3, assentosPorBaia: 6, fileiras: 2 },
    Gouvea: { baias: 2, assentosPorBaia: 6, fileiras: 2 }

// Configuração dos Setores por Local
const departmentsByLocation = {
    'Aquario': ['PTS', 'Centurion', 'BTG'],
    'Salao':   ['CEP', 'Lazer', 'Eventos', 'Supplier', 'ICs'],
    'Gouvea':  ['Financeiro', 'C&P', 'MKT & Com', 'TI', 'Projetos', 'Qualidade']

};
};

let reservations = [];
let selectedSeat = null;

// Inicializar a data de hoje
document.getElementById('reservation-date').valueAsDate = new Date();

// Gerar assentos com duas fileiras por baia
function generateSeats() {
    document.querySelectorAll('.row').forEach(row => {
        const location = row.dataset.location;
        const rowNum = parseInt(row.dataset.row);
        const seatsContainer = row.querySelector('.seats');
        const config = seatingConfig[location];
        
        // Limpar container
        seatsContainer.innerHTML = '';
        
        // Criar duas fileiras de assentos
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
            const reservation = reservations.find(r => 
                r.data === selectedDate && 
                `${r.local}-${r.baia}-${r.assento}` === seatId
            );
            if (reservation) {
                seat.title = `${reservation.nome} - ${reservation.setor}`;
            }
        } else {
            seat.className = 'seat available';
            seat.title = '';
        }
    });
}

// Selecionar assento e carregar menu correto
function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Este assento já está ocupado!');
        return;
    }
    
    // Remover seleção anterior visual
    document.querySelectorAll('.seat.selected').forEach(s => {
        if (s.classList.contains('occupied')) {
            s.className = 'seat occupied';
        } else {
            s.className = 'seat available';
        }
    });
    
    // Marcar novo assento
    seat.classList.add('selected');
    selectedSeat = seat;
    
    // --- LÓGICA DO MENU DINÂMICO (NOVO) ---
    const location = seat.dataset.location; // Pega o local (Aquario, Salao, Gouvea)
    const departmentSelect = document.getElementById('department');
    
    // Limpar opções antigas
    departmentSelect.innerHTML = '<option value="">Selecione seu setor...</option>';
    
    // Carregar opções baseadas no local
    if (departmentsByLocation[location]) {
        departmentsByLocation[location].forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    }
    // ---------------------------------------
    
    // Preencher textos do Modal
    const modal = document.getElementById('reservation-modal');
    const locationNames = {
        'Aquario': 'Aquário',
        'Salao': 'Salão',
        'Gouvea': 'Lado Gouvêa'
    };
    
    const seatInfo = `${locationNames[location]} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
    document.getElementById('selected-seat').textContent = seatInfo;
    
    // Abrir modal
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
    
    // Mostrar loading
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Salvando...';
    submitButton.disabled = true;
    
    try {
        // Salvar no Google Sheets
        const success = await saveReservation(reservation);
        
        if (success) {
            // Atualizar localmente
            reservations.push(reservation);
            updateSeatsStatus();
            
            // Fechar modal e limpar formulário
            document.getElementById('reservation-modal').style.display = 'none';
            document.getElementById('reservation-form').reset();
            selectedSeat = null;
            
            alert('Reserva confirmada com sucesso!');
        } else {
            throw new Error('Falha ao salvar');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar reserva. Por favor, tente novamente.');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

// Salvar reserva no Google Sheets
async function saveReservation(reservation) {
    try {
        // Criar FormData
        const formData = new FormData();
        formData.append('data', reservation.data);
        formData.append('nome', reservation.nome);
        formData.append('setor', reservation.setor);
        formData.append('local', reservation.local);
        formData.append('baia', reservation.baia);
        formData.append('assento', reservation.assento);
        formData.append('timestamp', reservation.timestamp);
        
        // Enviar com redirect: 'follow' para permitir redirecionamento do Google
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: formData,
            redirect: 'follow'
        });
        
        // Aguardar para garantir que salvou
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Recarregar reservas para confirmar
        await loadReservations();
        
        return true;
    } catch (error) {
        console.error('Erro ao salvar:', error);
        return false;
    }
}

// Carregar reservas do Google Sheets
async function loadReservations() {
    try {
        const response = await fetch(SHEET_CSV_URL + '&t=' + new Date().getTime());
        const text = await response.text();
        const rows = text.trim().split('\n').slice(1);
        
        reservations = rows
            .filter(row => row.trim())
            .map(row => {
                const [data, nome, setor, local, baia, assento] = row.split(',');
                return { 
                    data: data?.trim(), 
                    nome: nome?.trim(), 
                    setor: setor?.trim(), 
                    local: local?.trim(), 
                    baia: baia?.trim(), 
                    assento: assento?.trim() 
                };
            })
            .filter(r => r.data);
        
        updateSeatsStatus();
    } catch (error) {
        console.error('Erro ao carregar reservas:', error);
    }
}

// Event listener para mudança de data
document.getElementById('reservation-date').addEventListener('change', updateSeatsStatus);

// Recarregar reservas periodicamente
setInterval(loadReservations, 30000);

// Inicializar
generateSeats();
loadReservations();
