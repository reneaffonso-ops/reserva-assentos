// --- CONFIGURAÇÃO ---
// Insira aqui a URL do seu Google Apps Script (Executável/Web App)
const API_URL = 'https://script.google.com/macros/s/AKfycbxzne0CvsiNNKKo9l_ckTPZy2UzLBXiQt055fgIt5Dsa_1Hp-ktoeb3UzrJyED0pV9TRA/exec'; 

// Configurações de Layout
const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 6, fileiras: 2 },
    Salao: { baias: 3, assentosPorBaia: 6, fileiras: 2 },
    Gouvea: { baias: 2, assentosPorBaia: 6, fileiras: 2 }
};

// Configuração dos Setores por Local
const departmentsByLocation = {
    'Aquario': ['PTS', 'Centurion', 'BTG'],
    'Salao':   ['CEP', 'Lazer', 'Eventos', 'Supplier', 'ICs'],
    'Gouvea':  ['Financeiro', 'C&P', 'MKT & Com', 'TI', 'Projetos', 'Qualidade']
};

let allReservations = [];
let selectedSeat = null;

// --- INICIALIZAÇÃO ---
window.onload = function() {
    document.getElementById('reservation-date').valueAsDate = new Date();
    generateSeats();
    
    // Carregamento Inicial
    fetchReservations();
    
    // Atualização automática rápida (Polling)
    setInterval(fetchReservations, 5000); // 5 segundos
};

// --- EVENTOS ---
document.getElementById('reservation-date').addEventListener('change', () => {
    updateSeatsStatus(); // Feedback visual imediato
    fetchReservations(); // Busca dados atualizados da nova data
});

document.querySelector('.close').addEventListener('click', closeModal);

// --- COMUNICAÇÃO COM O SERVIDOR (API) ---

// Função de Busca (GET)
async function fetchReservations() {
    try {
        const response = await fetch(API_URL, { redirect: 'follow' });
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allReservations = data;
            updateSeatsStatus();
        } else if (data.error) {
            console.error("Erro na API:", data.error);
        }
    } catch (error) {
        console.error("Erro de conexão:", error);
    }
}

// --- LÓGICA DE INTERFACE ---

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
                // ID Único: Local-Baia-Assento
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
        const seatId = seat.dataset.id;
        
        // Busca reserva compatível (Backend já envia data normalizada)
        const reservation = allReservations.find(r => 
            r.data === selectedDate && 
            `${r.local}-${r.baia}-${r.assento}` === seatId
        );
        
        seat.className = 'seat'; // Limpa classes
        
        if (reservation) {
            seat.classList.add('occupied');
            seat.title = `${reservation.nome} (${reservation.setor})`;
            
            // Se o assento selecionado acabou de ser ocupado por outro
            if (selectedSeat && selectedSeat === seat) {
                closeModal();
                alert(`ATENÇÃO: O assento ${seat.textContent} acabou de ser ocupado por ${reservation.nome}!`);
                selectedSeat = null;
            }
        } else {
            seat.classList.add('available');
            seat.title = 'Livre';
        }
        
        // Mantém visual do selecionado atual
        if (selectedSeat && seat === selectedSeat) {
            seat.classList.remove('available');
            seat.classList.add('selected');
        }
    });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied')) {
        alert('Este assento já está ocupado por: ' + seat.title);
        return;
    }
    
    // Remove seleção anterior
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available'); // Retorna ao estado livre
    }
    
    seat.classList.add('selected');
    seat.classList.remove('available');
    selectedSeat = seat;
    
    // Popula o Menu de Setores
    const location = seat.dataset.location;
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">Selecione...</option>';
    
    const options = departmentsByLocation[location] || [];
    if(options.length > 0) {
        options.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            deptSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.textContent = "Sem opções";
        deptSelect.appendChild(opt);
    }
    
    // Atualiza Modal
    const displayNames = { 'Aquario': 'Aquário', 'Salao': 'Salão', 'Gouvea': 'Lado Gouvêa' };
    document.getElementById('selected-seat').textContent = 
        `${displayNames[location] || location} - Baia ${seat.dataset.row} - Assento ${seat.dataset.number}`;
        
    document.getElementById('reservation-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available'); // Libera visualmente
        selectedSeat = null;
    }
    document.getElementById('reservation-form').reset();
}

// --- ENVIO SEGURO COM VALIDAÇÃO DE FILA (POST) ---
document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedSeat) return;

    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Verificando fila...'; // Feedback para o usuário
    btn.disabled = true;

    // Prepara dados
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
            // Atualização forçada para garantir que todos vejam o bloqueio
            await fetchReservations(); 
            
        } else if (result.error === 'DUPLICATE') {
            // TRATAMENTO DE CONFLITO
            alert(`ATENÇÃO: Este lugar acabou de ser reservado!\n\nMotivo: ${result.message}`);
            closeModal();
            await fetchReservations(); // Atualiza a tela para pintar o lugar de vermelho
            
        } else {
            throw new Error(result.error || 'Erro desconhecido no servidor');
        }

    } catch (error) {
        console.error(error);
        alert('Erro de conexão: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});
