// Initialize global cache for exchange info
if (!window.BINANCE) {
    window.BINANCE = {
        exchangeInfo: null,
        lastFetch: null
    };
}

// Binance Futures Datafeed
class BinanceDatafeed {
    constructor() {
        this.subscribers = {};
        this.baseUrl = 'https://fapi.binance.com/fapi/v1';
        this.cacheDuration = 30 * 60 * 1000; // 5 minutes cache
    }

    onReady(callback) {
        setTimeout(() => callback({
            supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
            exchanges: [
                { value: 'BINANCE', name: 'Binance', desc: 'Binance Futures' }
            ],
            symbols_types: [{ name: 'Crypto', value: 'crypto' }],
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true
        }), 0);
    }

    // Fetch and cache exchange info
    async getExchangeInfo() {
        const now = Date.now();
        
        // Check if cache is valid
        if (window.BINANCE.exchangeInfo && 
            window.BINANCE.lastFetch && 
            (now - window.BINANCE.lastFetch) < this.cacheDuration) {
            console.log('Using cached exchangeInfo');
            return window.BINANCE.exchangeInfo;
        }

        // Fetch new data
        try {
            console.log('Fetching exchangeInfo from API');
            const response = await fetch(`${this.baseUrl}/exchangeInfo`);
            const data = await response.json();
            
            // Cache the data
            window.BINANCE.exchangeInfo = data;
            window.BINANCE.lastFetch = now;
            
            return data;
        } catch (error) {
            console.error('Error fetching exchangeInfo:', error);
            // Return cached data if available, even if expired
            return window.BINANCE.exchangeInfo || { symbols: [] };
        }
    }

    async searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        try {
            const data = await this.getExchangeInfo();
            let symbols = data.symbols.filter(s => s.status === 'TRADING');

            // Filter by user input
            if (userInput && userInput.trim() !== '') {
                const searchTerm = userInput.toUpperCase();
                symbols = symbols.filter(s =>
                    s.symbol.includes(searchTerm) ||
                    s.baseAsset.includes(searchTerm) ||
                    s.quoteAsset.includes(searchTerm)
                );
            }

            // Map to result format
            const results = symbols
                .slice(0, 100)
                .map(s => {
                    const baseAsset = s.baseAsset.toLowerCase()
                        .replace(/^1000/, '')
                        .replace(/^000/, '');
                    
                    return {
                        symbol: s.symbol,
                        full_name: `BINANCE:${s.symbol}`,
                        description: `${s.baseAsset}/${s.quoteAsset}`,
                        exchange: 'BINANCE',
                        type: 'crypto',
                        exchange_logo: 'image/iconexchange/binance.svg',
                        logo_urls: [
                            `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                            'image/iconexchange/binance.svg'
                        ]
                    };
                });

            onResultReadyCallback(results);
        } catch (error) {
            console.error('Search error:', error);
            onResultReadyCallback([]);
        }
    }

    async resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        const parts = symbolName.split(':');
        const symbol = parts.length > 1 ? parts[1] : parts[0];

        try {
            const priceInfo = await this.getSymbolPriceInfo(symbol);

            // Extract base asset for logo
            const baseAsset = symbol
                .replace(/USDT|BUSD|USDC|PERP/g, '')
                .toLowerCase()
                .replace(/^1000/, '')
                .replace(/^000/, '');

            onSymbolResolvedCallback({
                name: symbol,
                description: symbol,
                type: 'crypto',
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: 'BINANCE',
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `BINANCE:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    'image/iconexchange/binance.svg'
                ]
            });
        } catch (error) {
            console.error('Error resolving symbol:', error);
            onResolveErrorCallback('Symbol not found');
        }
    }

    async getSymbolPriceInfo(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`);
            const data = await response.json();
            const price = parseFloat(data.price);
            return this.calculatePrecision(price);
        } catch (error) {
            console.error('Error fetching symbol price:', error);
            return { minmov: 1, pricescale: 100 };
        }
    }

    calculatePrecision(price) {
        if (price === 0) {
            return { minmov: 1, pricescale: 100 };
        }

        let decimals;
        if (price >= 1000) decimals = 2;
        else if (price >= 100) decimals = 2;
        else if (price >= 10) decimals = 3;
        else if (price >= 1) decimals = 4;
        else if (price >= 0.1) decimals = 5;
        else if (price >= 0.01) decimals = 6;
        else if (price >= 0.001) decimals = 7;
        else decimals = 8;

        return {
            minmov: 1,
            pricescale: Math.pow(10, decimals)
        };
    }

    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to } = periodParams;
        const symbol = symbolInfo.name;

        const intervalMap = {
            '1': '1m', '5': '5m', '15': '15m', '30': '30m',
            '60': '1h', '240': '4h', '1D': '1d', '1W': '1w', '1M': '1M'
        };
        const interval = intervalMap[resolution] || '15m';

        try {
            const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=1500`;
            const response = await fetch(url);
            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                onHistoryCallback([], { noData: true });
                return;
            }

            const bars = data.map(bar => ({
                time: bar[0],
                open: parseFloat(bar[1]),
                high: parseFloat(bar[2]),
                low: parseFloat(bar[3]),
                close: parseFloat(bar[4]),
                volume: parseFloat(bar[5])
            }));

            onHistoryCallback(bars, { noData: false });
        } catch (error) {
            console.error('Error fetching bars:', error);
            onErrorCallback(error);
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name.toLowerCase();

        const intervalMap = {
            '1': '1m', '5': '5m', '15': '15m', '30': '30m',
            '60': '1h', '240': '4h', '1D': '1d', '1W': '1w', '1M': '1M'
        };
        const interval = intervalMap[resolution] || '15m';

        const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol}@kline_${interval}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.k) {
                onRealtimeCallback({
                    time: data.k.t,
                    open: parseFloat(data.k.o),
                    high: parseFloat(data.k.h),
                    low: parseFloat(data.k.l),
                    close: parseFloat(data.k.c),
                    volume: parseFloat(data.k.v)
                });
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket closed for', symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }

    unsubscribeBars(subscriberUID) {
        const ws = this.subscribers[subscriberUID];
        if (ws) {
            ws.close();
            delete this.subscribers[subscriberUID];
        }
    }
}
