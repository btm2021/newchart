// Screener Dialog - Binance Futures Market Overview
class ScreenerDialog extends DialogBase {
    constructor() {
        super({
            id: 'screener',
            title: 'Market Screener',
            width: '95vw',
            maxHeight: '95vh'
        });
        
        this.symbols = [];
        this.sortColumn = 'volume';
        this.sortDirection = 'desc';
        this.ws = null;
    }

    create() {
        super.create();
        this.renderContent();
        this.loadData();
        return this;
    }

    renderContent() {
        const content = document.createElement('div');
        content.className = 'screener-container';

        // Header with stats
        const header = document.createElement('div');
        header.className = 'screener-header';
        header.innerHTML = `
            <div class="screener-stats">
                <div class="stat-item">
                    <span class="stat-label">Total Symbols:</span>
                    <span class="stat-value" id="total-symbols">-</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">24h Volume:</span>
                    <span class="stat-value" id="total-volume">-</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Gainers:</span>
                    <span class="stat-value positive" id="gainers">-</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Losers:</span>
                    <span class="stat-value negative" id="losers">-</span>
                </div>
            </div>
            <div class="screener-actions">
                <input type="text" id="screener-search" class="tv-form-input" placeholder="Search symbol..." style="width: 200px; margin-right: 8px;">
                <button class="tv-button secondary" id="refresh-btn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.65 2.35A8 8 0 102.35 13.65" stroke="currentColor" stroke-width="2" fill="none"/>
                        <path d="M14 2v4h-4" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                    Refresh
                </button>
            </div>
        `;

        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'screener-table-container';
        tableContainer.innerHTML = `
            <table class="screener-table">
                <thead>
                    <tr>
                        <th data-sort="symbol">Symbol</th>
                        <th data-sort="lastPrice" class="text-right">Price</th>
                        <th data-sort="priceChangePercent" class="text-right">24h %</th>
                        <th data-sort="priceChange" class="text-right">24h Change</th>
                        <th data-sort="volume" class="text-right">Volume (USDT)</th>
                        <th data-sort="high" class="text-right">High</th>
                        <th data-sort="low" class="text-right">Low</th>
                        <th data-sort="trades" class="text-right">Trades</th>
                    </tr>
                </thead>
                <tbody id="screener-tbody">
                    <tr>
                        <td colspan="8" class="loading-cell">
                            <div class="loading-spinner-small"></div>
                            Loading market data...
                        </td>
                    </tr>
                </tbody>
            </table>
        `;

        content.appendChild(header);
        content.appendChild(tableContainer);
        
        this.setContent(content);
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        // Search input
        const searchInput = document.getElementById('screener-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterSymbols(e.target.value);
            });
        }

        // Sort headers
        const headers = this.dialog.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const column = header.getAttribute('data-sort');
                this.sortTable(column);
            });
        });

        // Row click to change symbol
        this.dialog.addEventListener('click', (e) => {
            const row = e.target.closest('tr[data-symbol]');
            if (row) {
                const symbol = row.getAttribute('data-symbol');
                this.changeSymbol(symbol);
            }
        });
    }

    async loadData() {
        try {
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) refreshBtn.disabled = true;

            // Fetch 24hr mini ticker
            const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
            const data = await response.json();

            // Filter trading symbols and sort by volume
            this.symbols = data
                .filter(s => s.symbol.endsWith('USDT'))
                .map(s => ({
                    symbol: s.symbol,
                    lastPrice: parseFloat(s.lastPrice),
                    priceChange: parseFloat(s.priceChange),
                    priceChangePercent: parseFloat(s.priceChangePercent),
                    volume: parseFloat(s.quoteVolume),
                    high: parseFloat(s.highPrice),
                    low: parseFloat(s.lowPrice),
                    trades: parseInt(s.count)
                }));

            this.sortTable(this.sortColumn);
            this.updateStats();
            this.renderTable();

            if (refreshBtn) refreshBtn.disabled = false;
        } catch (error) {
            console.error('Error loading screener data:', error);
            alert('Failed to load market data');
        }
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }

        this.symbols.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            if (column === 'symbol') {
                aVal = aVal.toString();
                bVal = bVal.toString();
            }

            if (this.sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        this.renderTable();
        this.updateSortIndicators();
    }

    updateSortIndicators() {
        const headers = this.dialog.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            const column = header.getAttribute('data-sort');
            header.classList.remove('sort-asc', 'sort-desc');
            
            if (column === this.sortColumn) {
                header.classList.add(`sort-${this.sortDirection}`);
            }
        });
    }

    updateStats() {
        const totalSymbols = this.symbols.length;
        const totalVolume = this.symbols.reduce((sum, s) => sum + s.volume, 0);
        const gainers = this.symbols.filter(s => s.priceChangePercent > 0).length;
        const losers = this.symbols.filter(s => s.priceChangePercent < 0).length;

        document.getElementById('total-symbols').textContent = totalSymbols;
        document.getElementById('total-volume').textContent = this.formatVolume(totalVolume);
        document.getElementById('gainers').textContent = gainers;
        document.getElementById('losers').textContent = losers;
    }

    filterSymbols(searchTerm) {
        const tbody = document.getElementById('screener-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[data-symbol]');
        const term = searchTerm.toUpperCase();

        rows.forEach(row => {
            const symbol = row.getAttribute('data-symbol');
            if (symbol.includes(term)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    renderTable() {
        const tbody = document.getElementById('screener-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.symbols.forEach(symbol => {
            const row = document.createElement('tr');
            row.setAttribute('data-symbol', symbol.symbol);
            row.className = 'screener-row';

            const changeClass = symbol.priceChangePercent >= 0 ? 'positive' : 'negative';
            const changeSign = symbol.priceChangePercent >= 0 ? '+' : '';

            row.innerHTML = `
                <td class="symbol-cell">
                    <span class="symbol-name">${symbol.symbol.replace('USDT', '')}</span>
                    <span class="symbol-quote">/USDT</span>
                </td>
                <td class="text-right">${this.formatPrice(symbol.lastPrice)}</td>
                <td class="text-right ${changeClass}">${changeSign}${symbol.priceChangePercent.toFixed(2)}%</td>
                <td class="text-right ${changeClass}">${changeSign}${this.formatPrice(symbol.priceChange)}</td>
                <td class="text-right">${this.formatVolume(symbol.volume)}</td>
                <td class="text-right">${this.formatPrice(symbol.high)}</td>
                <td class="text-right">${this.formatPrice(symbol.low)}</td>
                <td class="text-right">${this.formatNumber(symbol.trades)}</td>
            `;

            tbody.appendChild(row);
        });
    }

    formatPrice(price) {
        if (price >= 1000) return price.toFixed(2);
        if (price >= 1) return price.toFixed(4);
        if (price >= 0.01) return price.toFixed(6);
        return price.toFixed(8);
    }

    formatVolume(volume) {
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toFixed(2);
    }

    formatNumber(num) {
        return num.toLocaleString();
    }

    changeSymbol(symbol) {
        if (typeof tvWidget !== 'undefined' && tvWidget.chart) {
            tvWidget.chart().setSymbol(`BINANCE:${symbol}`, () => {
                this.close();
            });
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        super.close();
    }
}

// Export
window.ScreenerDialog = ScreenerDialog;
