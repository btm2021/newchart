/**
 * MEXC Futures Datasource Config
 */
const MEXC_FUTURES_CONFIG = {
    id: 'MEXC_FUTURES',
    name: 'MEXC Futures',
    description: 'MEXC Perpetual',
    exchange: 'MEXC Futures',
    logo: 'image/iconexchange/mexc.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://autumn-heart-5bf8.trinhminhbao.workers.dev/?url=https://contract.mexc.com/api/v1/contract',
    wsUrl: 'https://autumn-heart-5bf8.trinhminhbao.workers.dev/?url=wss://contract.mexc.com/ws',
    logPrefix: '[MEXC Futures]',
    blacklistPatterns: [],
    maxSearchResults: 200,
    searchSuffixes: ['.MF', '.MEXCF']
};

/**
 * MEXC Futures Datasource
 * Implementation cho MEXC Perpetual API
 */
class MEXCFuturesDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = MEXC_FUTURES_CONFIG.baseUrl;
        this.wsUrl = MEXC_FUTURES_CONFIG.wsUrl;
    }

    getInfo() {
        return MEXC_FUTURES_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        return upper.startsWith('MEXC_FUTURES:') || upper.startsWith('MEXCF:');
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/detail`);
            const data = await response.json();

            if (!data.data) {
                console.error(`${MEXC_FUTURES_CONFIG.logPrefix} API error`);
                return [];
            }

            return data.data
                .filter(s => {
                    if (!s.symbol.endsWith('_USDT')) return false;

                    for (const pattern of MEXC_FUTURES_CONFIG.blacklistPatterns) {
                        if (s.symbol.includes(pattern)) return false;
                    }

                    return true;
                })
                .map(s => ({
                    symbol: s.symbol.replace('_USDT', 'USDT'),
                    contractSymbol: s.symbol,
                    baseCoin: s.baseCoin,
                    quoteCoin: s.quoteCoin
                }));
        } catch (error) {
            console.error(`${MEXC_FUTURES_CONFIG.logPrefix} Error fetching instruments:`, error);
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
                full_name: `MEXC_FUTURES:${s.symbol}`,
                description: `${s.baseCoin}/${s.quoteCoin} Perp`,
                exchange: MEXC_FUTURES_CONFIG.exchange,
                type: MEXC_FUTURES_CONFIG.type,
                exchange_logo: MEXC_FUTURES_CONFIG.logo,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    MEXC_FUTURES_CONFIG.logo
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, MEXC_FUTURES_CONFIG.maxSearchResults)
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
                type: MEXC_FUTURES_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: MEXC_FUTURES_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: MEXC_FUTURES_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `MEXC_FUTURES:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    MEXC_FUTURES_CONFIG.logo
                ]
            };
        } catch (error) {
            console.error(`${MEXC_FUTURES_CONFIG.logPrefix} Error resolving symbol:`, error);
            throw new Error('Symbol not found');
        }
    }

    async getSymbolPriceInfo(symbol) {
        try {
            const contractSymbol = symbol.replace('USDT', '_USDT');
            const response = await fetch(`${this.baseUrl}/ticker?symbol=${contractSymbol}`);
            const data = await response.json();

            if (!data.data || !data.data.lastPrice) {
                return { minmov: 1, pricescale: 100 };
            }

            const price = parseFloat(data.data.lastPrice);
            return this.calculatePrecision(price);
        } catch (error) {
            console.error(`${MEXC_FUTURES_CONFIG.logPrefix} Error fetching price:`, error);
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
        const contractSymbol = symbol.replace('USDT', '_USDT');

        const intervalMap = {
            '1': 'Min1',
            '5': 'Min5',
            '15': 'Min15',
            '30': 'Min30',
            '60': 'Min60',
            '240': 'Hour4',
            '1D': 'Day1',
            '1W': 'Week1',
            '1M': 'Month1'
        };
        const interval = intervalMap[resolution] || 'Min15';

        try {
            const url = `${this.baseUrl}/kline/${contractSymbol}?interval=${interval}&start=${from}&end=${to}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!data.data || !data.data.time || data.data.time.length === 0) {
                return { bars: [], meta: { noData: true } };
            }

            const bars = data.data.time.map((time, index) => ({
                time: time * 1000,
                open: parseFloat(data.data.open[index]),
                high: parseFloat(data.data.high[index]),
                low: parseFloat(data.data.low[index]),
                close: parseFloat(data.data.close[index]),
                volume: parseFloat(data.data.vol[index])
            }));

            return { bars, meta: { noData: false } };
        } catch (error) {
            console.error(`${MEXC_FUTURES_CONFIG.logPrefix} Error fetching bars:`, error);
            throw error;
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name;
        const contractSymbol = symbol.replace('USDT', '_USDT');

        const intervalMap = {
            '1': 'Min1',
            '5': 'Min5',
            '15': 'Min15',
            '30': 'Min30',
            '60': 'Min60',
            '240': 'Hour4',
            '1D': 'Day1',
            '1W': 'Week1',
            '1M': 'Month1'
        };
        const interval = intervalMap[resolution] || 'Min15';

        const ws = new WebSocket(this.wsUrl);

        ws.onopen = () => {
            const subscribeMsg = {
                method: 'sub.kline',
                param: {
                    symbol: contractSymbol,
                    interval: interval
                }
            };
            ws.send(JSON.stringify(subscribeMsg));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.data && data.channel === 'push.kline') {
                const candle = data.data;
                onRealtimeCallback({
                    time: candle.t * 1000,
                    open: parseFloat(candle.o),
                    high: parseFloat(candle.h),
                    low: parseFloat(candle.l),
                    close: parseFloat(candle.c),
                    volume: parseFloat(candle.v)
                });
            }
        };

        ws.onerror = (error) => {
            console.error(`${MEXC_FUTURES_CONFIG.logPrefix} WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`${MEXC_FUTURES_CONFIG.logPrefix} WebSocket closed for`, symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }
}
