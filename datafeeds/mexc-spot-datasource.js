/**
 * MEXC Spot Datasource Config
 */
const MEXC_SPOT_CONFIG = {
    id: 'MEXC_SPOT',
    name: 'MEXC Spot',
    description: 'MEXC Spot Trading',
    exchange: 'MEXC Spot',
    logo: 'image/iconexchange/mexc.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://autumn-heart-5bf8.trinhminhbao.workers.dev/?url=https://api.mexc.com/api/v3',
    wsUrl: 'https://autumn-heart-5bf8.trinhminhbao.workers.dev/?url=wss://wbs.mexc.com/ws',
    logPrefix: '[MEXC Spot]',
    blacklistPatterns: [],
    maxSearchResults: 200,
    searchSuffixes: ['.MS', '.MEXCS']
};

/**
 * MEXC Spot Datasource
 * Implementation cho MEXC Spot Trading API
 */
class MEXCSpotDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = MEXC_SPOT_CONFIG.baseUrl;
        this.wsUrl = MEXC_SPOT_CONFIG.wsUrl;
    }

    getInfo() {
        return MEXC_SPOT_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        return upper.startsWith('MEXC_SPOT:') || upper.startsWith('MEXCS:');
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/exchangeInfo`);
            const data = await response.json();

            if (!data.symbols) {
                console.error(`${MEXC_SPOT_CONFIG.logPrefix} API error`);
                return [];
            }

            return data.symbols
                .filter(s => {
                    if (s.status !== 'ENABLED') return false;
                    if (!s.symbol.endsWith('USDT')) return false;

                    for (const pattern of MEXC_SPOT_CONFIG.blacklistPatterns) {
                        if (s.symbol.includes(pattern)) return false;
                    }

                    return true;
                })
                .map(s => ({
                    symbol: s.symbol,
                    baseAsset: s.baseAsset,
                    quoteAsset: s.quoteAsset
                }));
        } catch (error) {
            console.error(`${MEXC_SPOT_CONFIG.logPrefix} Error fetching exchangeInfo:`, error);
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
                s.baseAsset.includes(searchTerm)
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
                full_name: `MEXC_SPOT:${s.symbol}`,
                description: `${s.baseAsset}/${s.quoteAsset} Spot`,
                exchange: MEXC_SPOT_CONFIG.exchange,
                type: MEXC_SPOT_CONFIG.type,
                exchange_logo: MEXC_SPOT_CONFIG.logo,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    MEXC_SPOT_CONFIG.logo
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, MEXC_SPOT_CONFIG.maxSearchResults)
            .map(r => {
                delete r.score;
                return r;
            });
    }

    async resolveSymbol(symbolName) {
        const symbol = this.parseSymbolName(symbolName);

        try {
            const priceInfo = await this.getSymbolPriceInfo(symbol);
            const baseAsset = symbol.replace(/USDT/g, '').toLowerCase();

            return {
                name: symbol,
                description: `${symbol} Spot`,
                type: MEXC_SPOT_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: MEXC_SPOT_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: MEXC_SPOT_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `MEXC_SPOT:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    MEXC_SPOT_CONFIG.logo
                ]
            };
        } catch (error) {
            console.error(`${MEXC_SPOT_CONFIG.logPrefix} Error resolving symbol:`, error);
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
            console.error(`${MEXC_SPOT_CONFIG.logPrefix} Error fetching price:`, error);
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
            '1': '1m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1h',
            '240': '4h',
            '1D': '1d',
            '1W': '1w',
            '1M': '1M'
        };
        const interval = intervalMap[resolution] || '15m';

        try {
            const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=1000`;
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
            console.error(`${MEXC_SPOT_CONFIG.logPrefix} Error fetching bars:`, error);
            throw error;
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name;

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
                method: 'SUBSCRIPTION',
                params: [`spot@public.kline.v3.api@${symbol}@${interval}`]
            };
            ws.send(JSON.stringify(subscribeMsg));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.d && data.d.k) {
                const candle = data.d.k;
                onRealtimeCallback({
                    time: candle.t,
                    open: parseFloat(candle.o),
                    high: parseFloat(candle.h),
                    low: parseFloat(candle.l),
                    close: parseFloat(candle.c),
                    volume: parseFloat(candle.v)
                });
            }
        };

        ws.onerror = (error) => {
            console.error(`${MEXC_SPOT_CONFIG.logPrefix} WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`${MEXC_SPOT_CONFIG.logPrefix} WebSocket closed for`, symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }
}
