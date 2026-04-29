/**
 * Bybit Perpetual Datasource Config
 */
const BYBIT_FUTURES_CONFIG = {
    id: 'BYBIT_FUTURES',
    name: 'Bybit Perpetual',
    description: 'Bybit USDT Perpetual',
    exchange: 'Bybit Perpetual',
    logo: 'image/iconexchange/bybit.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://api.bybit.com/v5',
    wsUrl: 'wss://stream.bybit.com/v5/public/linear',
    logPrefix: '[Bybit Perpetual]',
    blacklistPatterns: [],
    maxSearchResults: 200,
    searchSuffixes: ['.BF', '.BYBITF']
};

/**
 * Bybit Futures Datasource
 * Implementation cho Bybit Perpetual API
 */
class BybitFuturesDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = BYBIT_FUTURES_CONFIG.baseUrl;
        this.wsUrl = BYBIT_FUTURES_CONFIG.wsUrl;
    }

    getInfo() {
        return BYBIT_FUTURES_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        return upper.startsWith('BYBIT:') ||
            upper.startsWith('BYBIT_FUTURES:') ||
            upper.startsWith('BYBITF:');
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/market/instruments-info?category=linear`);
            const data = await response.json();

            if (data.retCode !== 0 || !data.result || !data.result.list) {
                console.error(`${BYBIT_FUTURES_CONFIG.logPrefix} API error:`, data.retMsg);
                return [];
            }

            return data.result.list
                .filter(s => {
                    if (s.status !== 'Trading') return false;
                    if (!s.symbol.endsWith('USDT')) return false;

                    for (const pattern of BYBIT_FUTURES_CONFIG.blacklistPatterns) {
                        if (s.symbol.includes(pattern)) return false;
                    }

                    return true;
                })
                .map(s => ({
                    symbol: s.symbol,
                    baseCoin: s.baseCoin,
                    quoteCoin: s.quoteCoin,
                    priceFilter: s.priceFilter,
                    lotSizeFilter: s.lotSizeFilter
                }));
        } catch (error) {
            console.error(`${BYBIT_FUTURES_CONFIG.logPrefix} Error fetching instruments:`, error);
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
                s.baseCoin.includes(searchTerm)
            );
        }

        const results = filtered.map(s => {
            const searchUpper = userInput.toUpperCase();
            let score = 0;

            if (s.symbol === searchUpper) score += 1000;
            else if (s.symbol.startsWith(searchUpper)) score += 500;
            else if (s.baseCoin === searchUpper) score += 300;
            else if (s.baseCoin.startsWith(searchUpper)) score += 200;

            if (s.quoteCoin === 'USDT') score += 50;
            if (s.symbol.includes('BTC') || s.symbol.includes('ETH')) score += 30;

            const baseAsset = s.baseCoin.toLowerCase();

            return {
                symbol: s.symbol,
                full_name: `BYBIT_FUTURES:${s.symbol}`,
                description: `${s.baseCoin}/${s.quoteCoin} Perp`,
                exchange: BYBIT_FUTURES_CONFIG.exchange,
                type: BYBIT_FUTURES_CONFIG.type,
                exchange_logo: BYBIT_FUTURES_CONFIG.logo,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    BYBIT_FUTURES_CONFIG.logo
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, BYBIT_FUTURES_CONFIG.maxSearchResults)
            .map(r => {
                delete r.score;
                return r;
            });
    }

    async resolveSymbol(symbolName) {
        const symbol = this.parseSymbolName(symbolName);

        try {
            const priceInfo = await this.getSymbolPriceInfo(symbol);
            const baseAsset = symbol.replace(/USDT|PERP/g, '').toLowerCase();

            return {
                name: symbol,
                description: `${symbol} Perp`,
                type: BYBIT_FUTURES_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: BYBIT_FUTURES_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: BYBIT_FUTURES_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `BYBIT_FUTURES:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    BYBIT_FUTURES_CONFIG.logo
                ]
            };
        } catch (error) {
            console.error(`${BYBIT_FUTURES_CONFIG.logPrefix} Error resolving symbol:`, error);
            throw new Error('Symbol not found');
        }
    }

    async getSymbolPriceInfo(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/market/tickers?category=linear&symbol=${symbol}`);
            const data = await response.json();

            if (data.retCode !== 0 || !data.result || !data.result.list || data.result.list.length === 0) {
                return { minmov: 1, pricescale: 100 };
            }

            const price = parseFloat(data.result.list[0].lastPrice);
            return this.calculatePrecision(price);
        } catch (error) {
            console.error(`${BYBIT_FUTURES_CONFIG.logPrefix} Error fetching price:`, error);
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
            '1': '1',
            '5': '5',
            '15': '15',
            '30': '30',
            '60': '60',
            '240': '240',
            '1D': 'D',
            '1W': 'W',
            '1M': 'M'
        };
        const interval = intervalMap[resolution] || '15';

        try {
            const url = `${this.baseUrl}/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${from * 1000}&end=${to * 1000}&limit=1000`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.retCode !== 0 || !data.result || !data.result.list || data.result.list.length === 0) {
                return { bars: [], meta: { noData: true } };
            }

            const bars = data.result.list
                .map(candle => ({
                    time: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                }))
                .reverse();

            return { bars, meta: { noData: false } };
        } catch (error) {
            console.error(`${BYBIT_FUTURES_CONFIG.logPrefix} Error fetching bars:`, error);
            throw error;
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name;

        const intervalMap = {
            '1': '1',
            '5': '5',
            '15': '15',
            '30': '30',
            '60': '60',
            '240': '240',
            '1D': 'D',
            '1W': 'W',
            '1M': 'M'
        };
        const interval = intervalMap[resolution] || '15';

        const ws = new WebSocket(this.wsUrl);

        ws.onopen = () => {
            const subscribeMsg = {
                op: 'subscribe',
                args: [`kline.${interval}.${symbol}`]
            };
            ws.send(JSON.stringify(subscribeMsg));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.topic && data.data && data.data.length > 0) {
                const candle = data.data[0];
                onRealtimeCallback({
                    time: candle.start,
                    open: parseFloat(candle.open),
                    high: parseFloat(candle.high),
                    low: parseFloat(candle.low),
                    close: parseFloat(candle.close),
                    volume: parseFloat(candle.volume)
                });
            }
        };

        ws.onerror = (error) => {
            console.error(`${BYBIT_FUTURES_CONFIG.logPrefix} WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`${BYBIT_FUTURES_CONFIG.logPrefix} WebSocket closed for`, symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }
}
