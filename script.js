// Configurações
const CONFIG = {
  sheetURL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTCh8ynrVLz-2ir_EJI8YP4b1_jozi5tx-vD39JK7IS33Z-zJlsSiY2QkqSnfMfd1Bh-ouBIvFaOogf/pub?output=csv',
  updateInterval: 30000, // 30 segundos
  cacheDuration: 1800000, // 30 minutos
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
    // Verificar cache válido primeiro
    if (cuponsCache.data && cuponsCache.lastUpdated && 
        (Date.now() - cuponsCache.lastUpdated) < CONFIG.cacheDuration) {
      mostrarCupons(cuponsCache.data);
      return;
    }

    // Carregar da planilha com tratamento de erro
    const dados = await fetchWithRetry(CONFIG.sheetURL);
    const dadosParseados = parseCSV(dados);
    
    // Verificar se houve mudanças significativas
    if (!dadosIguais(cuponsCache.data, dadosParseados)) {
      cuponsCache = {
        data: dadosParseados,
        lastUpdated: Date.now(),
        etag: generateETag(dados)
      };
      
      // Salvar no localStorage
      localStorage.setItem('cuponsCache', JSON.stringify(cuponsCache));
      
      popularFiltro(dadosParseados);
      mostrarCupons(dadosParseados);
    }
  } catch (error) {
    console.error('Falha ao carregar dados:', error);
    // Tentar usar cache do localStorage se disponível
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
      headers: {
        'Cache-Control': 'no-cache'
      }
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
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    return headers.reduce((obj, h, i) => {
      obj[h] = (values[i] || '').replace(/(^"|"$)/g, '').trim();
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

  if (Math.random() > 0.7) {
    const badge = document.createElement('div');
    badge.className = 'card-badge';
    badge.textContent = 'EXCLUSIVO';
    div.appendChild(badge);
  }

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

  div.innerHTML = `
    <h3>${cupom["nome da loja"]}</h3>
    <p><strong>Desconto:</strong> ${cupom["Desconto"]}</p>
    <p><strong>Categoria:</strong> ${cupom["Categoria"]}</p>
    <p><strong>Validade:</strong> ${cupom["Validade"] || 'Limitado'}</p>
  `;
  div.appendChild(cupomCodigo);

  const link = document.createElement('a');
  link.className = 'btn';
  link.href = cupom["Link"];
  link.target = "_blank";
  link.innerHTML = `<i class="fas fa-arrow-right" style="margin-left: 8px;"></i> Aproveitar Oferta`;
  div.appendChild(link);

  return div;
}

// Popular filtro de categorias
function popularFiltro(cupons) {
  const select = document.getElementById('category-filter');
  
  // Limpar opções existentes (exceto a primeira)
  while (select.options.length > 1) {
    select.remove(1);
  }

  // Obter categorias únicas
  const categorias = ["Todos", ...new Set(cupons.map(c => c["Categoria"]))];
  
  // Adicionar opções
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // Configurar evento de change
  select.addEventListener('change', () => {
    mostrarCupons(cupons, select.value);
  });
}

// Mostrar cupons na tela
function mostrarCupons(cupons, categoria = 'Todos') {
  const container = document.getElementById('cupons');
  container.innerHTML = '';
  
  cupons
    .filter(c => categoria === 'Todos' || c["Categoria"] === categoria)
    .forEach(c => container.appendChild(criarCard(c)));
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Carregar cache inicial se existir
  const localCache = localStorage.getItem('cuponsCache');
  if (localCache) {
    cuponsCache = JSON.parse(localCache);
    mostrarCupons(cuponsCache.data);
  }
  
  // Carregar dados e configurar intervalo
  carregarDados();
  setInterval(carregarDados, CONFIG.updateInterval);
  
  // Configurar dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = darkModeToggle.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });
});

// Debug (opcional)
console.log('Sistema inicializado');
setInterval(() => {
  console.log('Estado do cache:', {
    lastUpdated: cuponsCache.lastUpdated ? new Date(cuponsCache.lastUpdated).toLocaleTimeString() : null,
    count: cuponsCache.data ? cuponsCache.data.length : 0
  });
}, 10000);