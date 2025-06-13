// Configurações
const CONFIG = {
  sheetURL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTCh8ynrVLz-2ir_EJI8YP4b1_jozi5tx-vD39JK7IS33Z-zJlsSiY2QkqSnfMfd1Bh-ouBIvFaOogf/pub?output=csv",
  updateInterval: 30000, // 30 segundos
  cacheDuration:30000, // 30 minutos (em milissegundos)
  maxRetries: 3
};

// Cache de dados
let cuponsCache = {
  data: null,
  lastUpdated: null,
  etag: null
};

// Função principal para carregar dados
async function carregarDados() {
  try {
    // Verificar cache válido
    if (cuponsCache.data && cuponsCache.lastUpdated &&
      (Date.now() - cuponsCache.lastUpdated) < CONFIG.cacheDuration) {
      mostrarCupons(cuponsCache.data);
      return;
    }

    // Buscar novos dados
    const dados = await fetchWithRetry(CONFIG.sheetURL);
    const dadosParseados = parseCSV(dados);

    // Verificar se os dados mudaram
    if (!dadosIguais(cuponsCache.data, dadosParseados)) {
      cuponsCache = {
        data: dadosParseados,
        lastUpdated: Date.now(),
        etag: generateETag(dados)
      };

      // Atualizar localStorage
      localStorage.setItem('cuponsCache', JSON.stringify(cuponsCache));

      // Atualizar UI
      popularFiltro(dadosParseados);
      mostrarCupons(dadosParseados);
    }
  } catch (error) {
    console.error('Falha ao carregar dados:', error);
    // Tentar recuperar do localStorage
    const localCache = localStorage.getItem('cuponsCache');
    if (localCache) {
      cuponsCache = JSON.parse(localCache);
      mostrarCupons(cuponsCache.data);
    }
  }
}

// Função para fetch com retry
async function fetchWithRetry(url, retries = CONFIG.maxRetries) {
  try {
    const response = await fetch(url, {
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!response.ok) throw new Error('Falha na rede');
    return await response.text();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000));
    return fetchWithRetry(url, retries - 1);
  }
}

// Parse do CSV
function parseCSV(csvText) {
  const [headerLine, ...lines] = csvText.trim().split('\n');
  const headers = headerLine.split(',').map(h => h.trim());

  return lines.map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
    return headers.reduce((obj, h, i) => {
      obj[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
      return obj;
    }, {});
  });
}

// Verificador de mudanças
function dadosIguais(antigo, novo) {
  if (!antigo || !novo) return false;
  return JSON.stringify(antigo) === JSON.stringify(novo);
}

// Gerador de ETag
function generateETag(data) {
  return btoa(data).substring(0, 32);
}

// Criar card de cupom
function criarCard(cupom) {
  const div = document.createElement('div');
  div.className = 'card';

  // Adicionar badge exclusivo aleatório
  if (Math.random() > 0.7) {
    const badge = document.createElement('div');
    badge.className = 'card-badge';
    badge.textContent = 'EXCLUSIVO';
    div.appendChild(badge);
  }

  // Código do cupom (clicável para copiar)
  const cupomCodigo = document.createElement('div');
  cupomCodigo.className = 'cupom-codigo';
  cupomCodigo.textContent = cupom["cupom"];
  cupomCodigo.title = "Clique para copiar";

  cupomCodigo.addEventListener('click', () => {
    navigator.clipboard.writeText(cupom["cupom"]).then(() => {
      cupomCodigo.classList.add('copiado');
      cupomCodigo.textContent = "COPIADO!";
      setTimeout(() => {
        cupomCodigo.classList.remove('copiado');
        cupomCodigo.textContent = cupom["cupom"];
      }, 2000);
    });
  });

  // Conteúdo do card
  div.innerHTML = `
    <h3>${cupom["nome da loja"]}</h3>
    <p><strong>Desconto:</strong> ${cupom["Desconto"]}</p>
    <p><strong>Categoria:</strong> ${cupom["Categoria"]}</p>
    <p><strong>Validade:</strong> ${cupom["Validade"] || 'Limitado'}</p>
  `;
  div.appendChild(cupomCodigo);

  // Botão de acesso à oferta
  const link = document.createElement('a');
  link.className = 'btn';
  link.href = cupom["Link"];
  link.target = "_blank";
  link.innerHTML = `<i class="fas fa-arrow-right" style="margin-left: 8px;"></i> Aproveitar Oferta`;
  div.appendChild(link);

  return div;
}

// Popular filtro de categorias (FUNÇÃO CORRIGIDA)
function popularFiltro(cupons) {
  if (!cupons || !Array.isArray(cupons)) return;

  const select = document.getElementById('category-filter');
  
  // Limpar options mantendo apenas o primeiro ("Todos")
  select.innerHTML = '<option value="Todos">Todos</option>';

  // Obter categorias únicas, válidas e ordenadas
  const categorias = [...new Set(cupons
    .map(c => c["Categoria"])
    .filter(categoria => categoria && categoria.trim() !== '')
  )].sort();

  // Adicionar opções ao select
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // Remover event listeners anteriores para evitar duplicação
  const newSelect = select.cloneNode(true);
  select.parentNode.replaceChild(newSelect, select);

  // Adicionar novo event listener
  newSelect.addEventListener('change', (e) => {
    mostrarCupons(cupons, e.target.value);
  });
}

// Mostrar cupons na tela
function mostrarCupons(cupons, categoria = 'Todos') {
  const container = document.getElementById('cupons');
  if (!container) return;

  // Limpar container
  container.innerHTML = '';

  // Filtrar e exibir cupons
  const cuponsFiltrados = cupons.filter(c => 
    categoria === 'Todos' || c["Categoria"] === categoria
  );

  if (cuponsFiltrados.length === 0) {
    container.innerHTML = '<p class="sem-resultados">Nenhum cupom encontrado para esta categoria.</p>';
    return;
  }

  cuponsFiltrados.forEach(c => container.appendChild(criarCard(c)));
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Carregar cache local se existir
  const localCache = localStorage.getItem('cuponsCache');
  if (localCache) {
    try {
      cuponsCache = JSON.parse(localCache);
      mostrarCupons(cuponsCache.data);
      popularFiltro(cuponsCache.data);
    } catch (e) {
      console.error('Erro ao parsear cache local:', e);
      localStorage.removeItem('cuponsCache');
    }
  }

  // Carregar dados inicial e configurar atualização periódica
  carregarDados();
  setInterval(carregarDados, CONFIG.updateInterval);

  // Configurar dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const icon = darkModeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
      }
      // Salvar preferência
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });

    // Aplicar dark mode salvo
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      const icon = darkModeToggle.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      }
    }
  }
});

// Debug (opcional)
console.log('Sistema de cupons inicializado');
setInterval(() => {
  console.log('Estado do cache:', {
    lastUpdated: cuponsCache.lastUpdated ? new Date(cuponsCache.lastUpdated).toLocaleTimeString() : null,
    count: cuponsCache.data ? cuponsCache.data.length : 0
  });
}, 10000);
