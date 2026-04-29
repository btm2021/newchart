/**
 * Binance Spot Datasource Config
 */
const BINANCE_SPOT_CONFIG = {
    id: 'BINANCE_SPOT',
    name: 'Binance Spot',
    description: 'Binance Spot Trading',
    exchange: 'Binance Spot',
    logo: 'image/iconexchange/binance.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://api.binance.com/api/v3',
    wsUrl: 'wss://stream.binance.com:9443/ws',
    logPrefix: '[Binance Spot]',
    blacklistPatterns: ['UP', 'DOWN', 'BULL', 'BEAR'],
    maxSearchResults: 200,
    searchSuffixes: ['.S', '.SPOT']
};

/**
 * Binance Spot Datasource
 * Implementation cho Binance Spot Trading API
 */
class BinanceSpotDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = BINANCE_SPOT_CONFIG.baseUrl;
        this.wsUrl = BINANCE_SPOT_CONFIG.wsUrl;
    }

    getInfo() {
        return BINANCE_SPOT_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        return upper.startsWith('BINANCE_SPOT:');
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/exchangeInfo`);
            const data = await response.json();

            // Filter TRADING symbols và loại bỏ blacklist
            return data.symbols.filter(s => {
                if (s.status !== 'TRADING') return false;

                // Check blacklist patterns
                for (const pattern of BINANCE_SPOT_CONFIG.blacklistPatterns) {
                    if (s.symbol.includes(pattern)) return false;
                }

                return true;
            });
        } catch (error) {
            console.error(`${BINANCE_SPOT_CONFIG.logPrefix} Error fetching exchangeInfo:`, error);
            return [];
        }
    }

    searchSymbols(userInput) {
        const symbols = window.symbolConfig?.[this.getInfo().id] || [];

        let filtered = symbols;
        if (userInput && userInput.trim() !== '') {
            const searchTerm = userInput.toUpperCase();
            filtered = symbols.filter(s =>
                s.symbol.includes(searchTerm) ||
                s.baseAsset.includes(searchTerm) ||
                s.quoteAsset.includes(searchTerm)
            );
        }

        const results = filtered.map(s => {
            const searchUpper = userInput.toUpperCase();
            let score = 0;

            if (s.symbol === searchUpper) score += 1000;
            else if (s.symbol.startsWith(searchUpper)) score += 500;
            else if (s.baseAsset === searchUpper) score += 300;
            else if (s.baseAsset.startsWith(searchUpper)) score += 200;

            if (s.quoteAsset === 'USDT') score += 50;
            if (s.symbol.includes('BTC') || s.symbol.includes('ETH')) score += 30;

            const baseAsset = s.baseAsset.toLowerCase();

            return {
                symbol: s.symbol,
                full_name: `BINANCE_SPOT:${s.symbol}`,
                description: `${s.baseAsset}/${s.quoteAsset} Spot`,
                exchange: BINANCE_SPOT_CONFIG.exchange,
                type: BINANCE_SPOT_CONFIG.type,
                exchange_logo: BINANCE_SPOT_CONFIG.logo,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${s.quoteAsset.toLowerCase()}.png`,
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, BINANCE_SPOT_CONFIG.maxSearchResults)
            .map(r => {
                delete r.score;
                return r;
            });
    }

    async resolveSymbol(symbolName) {
        const symbol = this.parseSymbolName(symbolName);

        try {
            const priceInfo = await this.getSymbolPriceInfo(symbol);
            const baseAsset = symbol
                .replace(/USDT|BUSD|USDC|BTC|ETH|BNB/g, '')
                .toLowerCase();

            return {
                name: symbol,
                description: `${symbol} Spot`,
                type: BINANCE_SPOT_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: BINANCE_SPOT_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: BINANCE_SPOT_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `BINANCE_SPOT:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`
                ]
            };
        } catch (error) {
            console.error(`${BINANCE_SPOT_CONFIG.logPrefix} Error resolving symbol:`, error);
            throw new Error('Symbol not found');
        }
    }

    async getSymbolPriceInfo(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`);
            const data = await response.json();
            const price = parseFloat(data.price);
            return this.calculatePrecision(price);
        } catch (error) {
            console.error(`${BINANCE_SPOT_CONFIG.logPrefix} Error fetching price:`, error);
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

    async getBars(symbolInfo, resolution, periodParams) {
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
                return { bars: [], meta: { noData: true } };
            }

            const bars = data.map(bar => ({
                time: bar[0],
                open: parseFloat(bar[1]),
                high: parseFloat(bar[2]),
                low: parseFloat(bar[3]),
                close: parseFloat(bar[4]),
                volume: parseFloat(bar[5])
            }));

            return { bars, meta: { noData: false } };
        } catch (error) {
            console.error(`${BINANCE_SPOT_CONFIG.logPrefix} Error fetching bars:`, error);
            throw error;
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name.toLowerCase();

        const intervalMap = {
            '1': '1m', '5': '5m', '15': '15m', '30': '30m',
            '60': '1h', '240': '4h', '1D': '1d', '1W': '1w', '1M': '1M'
        };
        const interval = intervalMap[resolution] || '15m';

        const ws = new WebSocket(`${this.wsUrl}/${symbol}@kline_${interval}`);

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
            console.error(`${BINANCE_SPOT_CONFIG.logPrefix} WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`${BINANCE_SPOT_CONFIG.logPrefix} WebSocket closed for`, symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }
}
