// Symbol List Dialog - Display loaded symbols
class SymbolListDialog extends DialogBase {
    constructor() {
        super({
            id: 'symbol-list',
            title: 'Loaded Symbols',
            width: '600px',
            maxHeight: '80vh'
        });
        
        this.symbols = [];
        this.filteredSymbols = [];
        this.searchTerm = '';
        this.selectedExchange = '';
    }

    create() {
        super.create();
        this.loadSymbols();
        this.renderContent();
        return this;
    }

    loadSymbols() {
        // Get current symbol from chart
        let currentSymbol = '';
        if (typeof tvWidget !== 'undefined' && tvWidget) {
            try {
                const chart = tvWidget.activeChart();
                if (chart) {
                    currentSymbol = chart.symbol();
                }
            } catch (error) {
                console.error('Error getting current symbol:', error);
            }
        }

        // Get all symbols from window.symbolConfig (loaded by DatafeedManager)
        if (window.symbolConfig) {
            const allSymbols = [];
            
            // Iterate through all datasources
            for (const [datasourceId, symbols] of Object.entries(window.symbolConfig)) {
                if (Array.isArray(symbols)) {
                    symbols.forEach(s => {
                        // Get exchange name from datasource ID
                        const exchangeName = this.getExchangeName(datasourceId);
                        const fullSymbol = `${exchangeName}:${s.symbol}`;
                        
                        allSymbols.push({
                            full: fullSymbol,
                            exchange: exchangeName,
                            symbol: s.symbol,
                            baseAsset: s.baseAsset || '',
                            quoteAsset: s.quoteAsset || '',
                            datasourceId: datasourceId,
                            isCurrent: fullSymbol === currentSymbol
                        });
                    });
                }
            }
            
            this.symbols = allSymbols;
        } else {
            console.warn('window.symbolConfig not available');
            this.symbols = [];
        }
        
        this.filteredSymbols = [...this.symbols];
    }

    getExchangeName(datasourceId) {
        const exchangeMap = {
            'BINANCE_FUTURES': 'BINANCE',
            'BINANCE_SPOT': 'BINANCE',
            'OKX_FUTURES': 'OKX',
            'OKX_SPOT': 'OKX',
            'BYBIT_FUTURES': 'BYBIT',
            'BYBIT_SPOT': 'BYBIT',
            'MEXC_FUTURES': 'MEXC',
            'MEXC_SPOT': 'MEXC',
            'KUCOIN_FUTURES': 'KUCOIN',
            'KUCOIN_SPOT': 'KUCOIN',
            'OANDA': 'OANDA'
        };
        return exchangeMap[datasourceId] || datasourceId;
    }

    renderContent() {
        const content = document.createElement('div');

        // Filter Section
        const filterSection = document.createElement('div');
        filterSection.className = 'tv-dialog-section';
        
        const grid = document.createElement('div');
        grid.className = 'tv-grid cols-2';
        
        // Search Input
        const searchInput = this.createInput({
            id: 'symbol-search',
            type: 'text',
            placeholder: 'Search symbols...'
        });
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        grid.appendChild(this.createFormGroup('Search', searchInput));
        
        // Exchange Filter
        const exchanges = this.getUniqueExchanges();
        const exchangeOptions = [
            { value: '', label: 'All Exchanges', selected: true },
            ...exchanges.map(ex => ({ value: ex, label: ex }))
        ];
        
        const exchangeSelect = this.createSelect({
            id: 'exchange-filter',
            options: exchangeOptions
        });
        exchangeSelect.addEventListener('change', (e) => this.handleExchangeFilter(e.target.value));
        grid.appendChild(this.createFormGroup('Exchange', exchangeSelect));
        
        filterSection.appendChild(grid);

        // Stats Section
        const statsSection = document.createElement('div');
        statsSection.className = 'tv-dialog-section';
        statsSection.style.padding = '8px 0';
        
        const statsText = document.createElement('div');
        statsText.className = 'tv-info-text';
        statsText.id = 'symbol-stats';
        statsText.textContent = `Total: ${this.symbols.length} symbols`;
        statsSection.appendChild(statsText);

        // List Section
        const listSection = document.createElement('div');
        listSection.className = 'tv-dialog-section';
        listSection.style.maxHeight = '400px';
        listSection.style.overflowY = 'auto';
        
        const listContainer = document.createElement('div');
        listContainer.id = 'symbol-list-container';
        listSection.appendChild(listContainer);

        // Assemble
        content.appendChild(filterSection);
        content.appendChild(statsSection);
        content.appendChild(listSection);
        
        this.setContent(content);
        this.renderList();
    }

    getUniqueExchanges() {
        const exchanges = new Set();
        this.symbols.forEach(item => exchanges.add(item.exchange));
        return Array.from(exchanges).sort();
    }

    handleExchangeFilter(exchange) {
        this.selectedExchange = exchange;
        this.applyFilters();
    }

    handleSearch(term) {
        this.searchTerm = term.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        this.filteredSymbols = this.symbols.filter(item => {
            // Exchange filter
            if (this.selectedExchange && item.exchange !== this.selectedExchange) {
                return false;
            }
            
            // Search filter
            if (this.searchTerm) {
                const matchesSearch = 
                    item.full.toLowerCase().includes(this.searchTerm) ||
                    item.symbol.toLowerCase().includes(this.searchTerm) ||
                    item.exchange.toLowerCase().includes(this.searchTerm) ||
                    item.baseAsset.toLowerCase().includes(this.searchTerm) ||
                    item.quoteAsset.toLowerCase().includes(this.searchTerm);
                
                if (!matchesSearch) return false;
            }
            
            return true;
        });
        
        this.renderList();
        this.updateStats();
    }

    renderList() {
        const container = document.getElementById('symbol-list-container');
        if (!container) return;
        
        container.innerHTML = '';

        if (this.filteredSymbols.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'tv-empty-state';
            emptyState.textContent = this.searchTerm ? 'No symbols found' : 'No symbols loaded yet';
            container.appendChild(emptyState);
            return;
        }

        this.filteredSymbols.forEach(item => {
            const symbolItem = this.createSymbolItem(item);
            container.appendChild(symbolItem);
        });
    }

    createSymbolItem(item) {
        const itemEl = document.createElement('div');
        itemEl.className = `symbol-list-item ${item.isCurrent ? 'current' : ''}`;
        
        // Format display name
        const displayName = item.baseAsset && item.quoteAsset 
            ? `${item.baseAsset}/${item.quoteAsset}` 
            : item.symbol;
        
        itemEl.innerHTML = `
            <div class="symbol-list-item-content">
                <div class="symbol-list-item-main">
                    <span class="symbol-list-item-symbol">${displayName}</span>
                    ${item.isCurrent ? '<span class="symbol-list-item-badge">Current</span>' : ''}
                </div>
                <div class="symbol-list-item-exchange">${item.exchange}</div>
            </div>
            <svg class="symbol-list-item-arrow" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
        `;

        itemEl.addEventListener('click', () => this.switchToSymbol(item.full));

        return itemEl;
    }

    switchToSymbol(symbol) {
        if (typeof tvWidget !== 'undefined' && tvWidget) {
            try {
                const chart = tvWidget.activeChart();
                if (chart) {
                    chart.setSymbol(symbol);
                    this.close();
                }
            } catch (error) {
                console.error('Error switching symbol:', error);
                alert('Failed to switch symbol');
            }
        }
    }

    updateStats() {
        const statsEl = document.getElementById('symbol-stats');
        if (statsEl) {
            if (this.searchTerm) {
                statsEl.textContent = `Showing ${this.filteredSymbols.length} of ${this.symbols.length} symbols`;
            } else {
                statsEl.textContent = `Total: ${this.symbols.length} symbols`;
            }
        }
    }
}

// Register tool
window.SymbolListDialog = SymbolListDialog;
