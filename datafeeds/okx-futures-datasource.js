/**
 * OKX Perpetual Datasource Config
 */
const OKX_FUTURES_CONFIG = {
    id: 'OKX_FUTURES',
    name: 'OKX Perpetual',
    description: 'OKX USDT Perpetual Swap',
    exchange: 'OKX Perpetual',
    logo: 'image/iconexchange/okx.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://www.okx.com/api/v5',
    wsUrl: 'wss://ws.okx.com:8443/ws/v5/public',
    logPrefix: '[OKX Perpetual]',
    blacklistPatterns: [],
    maxSearchResults: 200,
    searchSuffixes: ['.OF', '.OKXF']
};

/**
 * OKX Futures Datasource
 * Implementation cho OKX Perpetual Swap API
 */
class OKXFuturesDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = OKX_FUTURES_CONFIG.baseUrl;
        this.wsUrl = OKX_FUTURES_CONFIG.wsUrl;
    }

    getInfo() {
        return OKX_FUTURES_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        return upper.startsWith('OKX:') ||
            upper.startsWith('OKX_FUTURES:') ||
            upper.startsWith('OKXF:');
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/public/instruments?instType=SWAP`);
            const data = await response.json();

            if (data.code !== '0' || !data.data) {
                console.error(`${OKX_FUTURES_CONFIG.logPrefix} API error:`, data.msg);
                return [];
            }

            // Filter USDT perpetual swaps và loại bỏ blacklist
            return data.data
                .filter(s => {
                    if (s.state !== 'live') return false;
                    if (!s.instId.endsWith('-USDT-SWAP')) return false;

                    // Check blacklist patterns
                    for (const pattern of OKX_FUTURES_CONFIG.blacklistPatterns) {
                        if (s.instId.includes(pattern)) return false;
                    }

                    return true;
                })
                .map(s => ({
                    symbol: s.instId.replace('-USDT-SWAP', 'USDT'),
                    instId: s.instId,
                    baseCcy: s.ctValCcy,
                    quoteCcy: 'USDT',
                    tickSize: s.tickSz,
                    lotSize: s.ctVal
                }));
        } catch (error) {
            console.error(`${OKX_FUTURES_CONFIG.logPrefix} Error fetching instruments:`, error);
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
                s.baseCcy.includes(searchTerm)
            );
        }

        const results = filtered.map(s => {
            const searchUpper = userInput.toUpperCase();
            let score = 0;

            if (s.symbol === searchUpper) score += 1000;
            else if (s.symbol.startsWith(searchUpper)) score += 500;
            else if (s.baseCcy === searchUpper) score += 300;
            else if (s.baseCcy.startsWith(searchUpper)) score += 200;

            if (s.quoteCcy === 'USDT') score += 50;
            if (s.symbol.includes('BTC') || s.symbol.includes('ETH')) score += 30;

            const baseAsset = s.baseCcy.toLowerCase();

            return {
                symbol: s.symbol,
                full_name: `OKX_FUTURES:${s.symbol}`,
                description: `${s.baseCcy}/${s.quoteCcy} Perp`,
                exchange: OKX_FUTURES_CONFIG.exchange,
                type: OKX_FUTURES_CONFIG.type,
                exchange_logo: OKX_FUTURES_CONFIG.logo,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    OKX_FUTURES_CONFIG.logo
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, OKX_FUTURES_CONFIG.maxSearchResults)
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
                type: OKX_FUTURES_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: OKX_FUTURES_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: OKX_FUTURES_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `OKX_FUTURES:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    OKX_FUTURES_CONFIG.logo
                ]
            };
        } catch (error) {
            console.error(`${OKX_FUTURES_CONFIG.logPrefix} Error resolving symbol:`, error);
            throw new Error('Symbol not found');
        }
    }

    async getSymbolPriceInfo(symbol) {
        try {
            const instId = symbol.replace('USDT', '-USDT-SWAP');
            const response = await fetch(`${this.baseUrl}/market/ticker?instId=${instId}`);
            const data = await response.json();

            if (data.code !== '0' || !data.data || data.data.length === 0) {
                return { minmov: 1, pricescale: 100 };
            }

            const price = parseFloat(data.data[0].last);
            return this.calculatePrecision(price);
        } catch (error) {
            console.error(`${OKX_FUTURES_CONFIG.logPrefix} Error fetching price:`, error);
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
        const instId = symbol.replace('USDT', '-USDT-SWAP');

        const intervalMap = {
            '1': '1m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1H',
            '240': '4H',
            '1D': '1D',
            '1W': '1W',
            '1M': '1M'
        };
        const bar = intervalMap[resolution] || '15m';

        try {
            const url = `${this.baseUrl}/market/candles?instId=${instId}&bar=${bar}&after=${from * 1000}&before=${to * 1000}&limit=300`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== '0' || !data.data || data.data.length === 0) {
                return { bars: [], meta: { noData: true } };
            }

            const bars = data.data
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
            console.error(`${OKX_FUTURES_CONFIG.logPrefix} Error fetching bars:`, error);
            throw error;
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name;
        const instId = symbol.replace('USDT', '-USDT-SWAP');

        const intervalMap = {
            '1': '1m',
            '5': '5m',
            '15': '15m',
            '30': '30m',
            '60': '1H',
            '240': '4H',
            '1D': '1D',
            '1W': '1W',
            '1M': '1M'
        };
        const channel = intervalMap[resolution] || '15m';

        const ws = new WebSocket(this.wsUrl);

        ws.onopen = () => {
            const subscribeMsg = {
                op: 'subscribe',
                args: [
                    {
                        channel: `candle${channel}`,
                        instId: instId
                    }
                ]
            };
            ws.send(JSON.stringify(subscribeMsg));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.data && data.data.length > 0) {
                const candle = data.data[0];
                onRealtimeCallback({
                    time: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                });
            }
        };

        ws.onerror = (error) => {
            console.error(`${OKX_FUTURES_CONFIG.logPrefix} WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`${OKX_FUTURES_CONFIG.logPrefix} WebSocket closed for`, symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }
}
