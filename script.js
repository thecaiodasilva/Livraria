const API_KEY = 'AIzaSyA4IvS30etNgLyimhOlIvu8Po4wBpj9JBk'; // Substitua pela sua chave!

let currentPage = 1;
const resultsPerPage = 12;
let isLoading = false;
let hasMore = true;
let lastScrollPosition = 0;

// Configuração inicial
document.body.insertAdjacentHTML('beforeend', `
    <div class="loading">
        <i class="fas fa-spinner fa-spin"></i> Carregando...
    </div>
`);

// Função para analisar a busca
function parseSearchQuery(input) {
    const filters = {
        query: [],
        author: '',
        publisher: '',
        category: '',
        isbn: '',
        language: ''
    };

    const parts = input.split(/(\w+):/g);
    let currentFilter = 'query';

    for (let part of parts) {
        part = part.trim();
        if (!part) continue;

        if (part.startsWith('autor:')) {
            currentFilter = 'author';
            filters.author = part.replace('autor:', '').trim();
        } else if (part.startsWith('editora:')) {
            currentFilter = 'publisher';
            filters.publisher = part.replace('editora:', '').trim();
        } else if (part.startsWith('categoria:')) {
            currentFilter = 'category';
            filters.category = part.replace('categoria:', '').trim();
        } else if (part.startsWith('isbn:')) {
            currentFilter = 'isbn';
            filters.isbn = part.replace('isbn:', '').trim();
        } else if (part.startsWith('idioma:')) {
            currentFilter = 'language';
            filters.language = part.replace('idioma:', '').trim();
        } else {
            filters.query.push(part);
        }
    }

    let finalQuery = filters.query.join(' ');
    if (filters.author) finalQuery += ` inauthor:${filters.author}`;
    if (filters.publisher) finalQuery += ` inpublisher:${filters.publisher}`;
    if (filters.category) finalQuery += ` subject:${filters.category}`;
    if (filters.isbn) finalQuery += ` isbn:${filters.isbn}`;

    return {
        query: finalQuery,
        language: filters.language
    };
}

// Função principal de busca
async function searchBooks(shouldReset = true) {
    if (shouldReset) {
        currentPage = 1;
        hasMore = true;
        document.getElementById('results').innerHTML = '<div class="results-grid"></div>';
    }

    if (isLoading || !hasMore) return;
    isLoading = true;
    document.querySelector('.loading').style.display = 'block';

    try {
        const input = document.getElementById('searchInput').value;
        const { query, language } = parseSearchQuery(input);
        const startIndex = (currentPage - 1) * resultsPerPage;
        
        let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${resultsPerPage}&key=${API_KEY}`;
        if (language) url += `&langRestrict=${language}`;

        const response = await fetch(url);
        const data = await response.json();

        hasMore = data.items && data.items.length > 0;
        displayResults(data.items || [], !shouldReset);
        currentPage++;

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        isLoading = false;
        document.querySelector('.loading').style.display = 'none';
    }
}

// Exibir resultados na grid
function displayResults(books, append = false) {
    const grid = document.querySelector('.results-grid');
    if (!append) grid.innerHTML = '';

    books.forEach(book => {
        const info = book.volumeInfo;
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <img src="${info.imageLinks?.thumbnail?.replace('http://', 'https://') || 'https://via.placeholder.com/150x200?text=Sem+Capa'}" 
                 class="book-cover" 
                 alt="${info.title}">
            <div class="book-title">${info.title || 'Título desconhecido'}</div>
        `;

        card.addEventListener('click', () => showFullDetails(book));
        grid.appendChild(card);
    });
}

// Overlay de detalhes
function showFullDetails(book) {
    lastScrollPosition = window.scrollY;
    document.body.style.overflow = 'hidden';
    
    const overlay = document.createElement('div');
    overlay.className = 'book-overlay';
    overlay.innerHTML = `
        <div class="overlay-content">
            <button class="close-btn" onclick="closeOverlay()">&times; Fechar</button>
            <div class="full-details">
                <img src="${book.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') || 'https://via.placeholder.com/300x450?text=Sem+Capa'}" 
                     alt="${book.volumeInfo.title}">
                <div class="details">
                    <h2>${book.volumeInfo.title}</h2>
                    <div class="metadata">
                        ${book.volumeInfo.authors ? `<p><strong>Autor(es):</strong> ${book.volumeInfo.authors.join(', ')}</p>` : ''}
                        ${book.volumeInfo.publisher ? `<p><strong>Editora:</strong> ${book.volumeInfo.publisher}</p>` : ''}
                        ${book.volumeInfo.publishedDate ? `<p><strong>Publicação:</strong> ${book.volumeInfo.publishedDate}</p>` : ''}
                        ${book.volumeInfo.pageCount ? `<p><strong>Páginas:</strong> ${book.volumeInfo.pageCount}</p>` : ''}
                        ${book.volumeInfo.language ? `<p><strong>Idioma:</strong> ${book.volumeInfo.language.toUpperCase()}</p>` : ''}
                        ${book.volumeInfo.averageRating ? `<p><strong>Avaliação:</strong> ${book.volumeInfo.averageRating} ★ (${book.volumeInfo.ratingsCount} votos)</p>` : ''}
                        ${book.volumeInfo.industryIdentifiers ? `<p><strong>ISBN:</strong> ${book.volumeInfo.industryIdentifiers.map(i => i.identifier).join(', ')}</p>` : ''}
                        ${book.volumeInfo.categories ? `<p><strong>Categorias:</strong> ${book.volumeInfo.categories.map(c => `<span>${c}</span>`).join('')}</p>` : ''}
                    </div>
                    ${book.volumeInfo.description ? `<div class="description"><h3>Sinopse</h3><p>${book.volumeInfo.description}</p></div>` : ''}
                    <div class="recommendations">
                        <h3>Livros Recomendados</h3>
                        <div class="recommendations-grid"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.style.display = 'block';
    fetchRecommendations(book);
}

// Buscar recomendações
async function fetchRecommendations(book) {
    const searchTerm = book.volumeInfo.categories?.[0] || book.volumeInfo.authors?.[0] || book.volumeInfo.title;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&maxResults=3&key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        displayRecommendations(data.items || []);
    } catch (error) {
        console.error('Erro nas recomendações:', error);
    }
}

// Exibir recomendações
function displayRecommendations(books) {
    const grid = document.querySelector('.recommendations-grid');
    if (!grid) return;

    grid.innerHTML = books.map(book => `
        <div class="recommendation-card" onclick="showFullDetails(${JSON.stringify(book).replace(/"/g, '&quot;')})">
            <img src="${book.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') || 'https://via.placeholder.com/150x200?text=Sem+Capa'}" 
                 alt="${book.volumeInfo.title}">
            <p>${book.volumeInfo.title}</p>
        </div>
    `).join('');
}

// Fechar overlay
function closeOverlay() {
    const overlay = document.querySelector('.book-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = 'auto';
        window.scrollTo(0, lastScrollPosition);
    }
}

// Event listeners
window.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoading && hasMore) {
        searchBooks(false);
    }
});

document.querySelector('button').addEventListener('click', () => searchBooks(true));
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBooks(true);
});

// Iniciar
searchBooks(true);