/**
 * KuCoin Spot Datasource Config
 */
const KUCOIN_SPOT_CONFIG = {
    id: 'KUCOIN_SPOT',
    name: 'KuCoin Spot',
    description: 'KuCoin Spot Trading',
    exchange: 'KuCoin Spot',
    logo: 'image/iconexchange/kucoin.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://autumn-heart-5bf8.trinhminhbao.workers.dev/?url=https://api.kucoin.com/api/v1',
    wsUrl: 'wss://ws-api-spot.kucoin.com',
    logPrefix: '[KuCoin Spot]',
    blacklistPatterns: [],
    maxSearchResults: 200,
    searchSuffixes: ['.KS', '.KUCOINS']
};

/**
 * KuCoin Spot Datasource
 * Implementation cho KuCoin Spot Trading API
 */
class KuCoinSpotDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = KUCOIN_SPOT_CONFIG.baseUrl;
        this.wsUrl = KUCOIN_SPOT_CONFIG.wsUrl;
    }

    getInfo() {
        return KUCOIN_SPOT_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        return upper.startsWith('KUCOIN_SPOT:') || upper.startsWith('KUCOINS:');
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/symbols`);
            const data = await response.json();

            if (data.code !== '200000' || !data.data) {
                console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} API error:`, data.msg);
                return [];
            }

            return data.data
                .filter(s => {
                    if (!s.enableTrading) return false;
                    if (s.quoteCurrency !== 'USDT') return false;

                    for (const pattern of KUCOIN_SPOT_CONFIG.blacklistPatterns) {
                        if (s.symbol.includes(pattern)) return false;
                    }

                    return true;
                })
                .map(s => ({
                    symbol: s.symbol.replace('-', ''),
                    kucoinSymbol: s.symbol,
                    baseCurrency: s.baseCurrency,
                    quoteCurrency: s.quoteCurrency
                }));
        } catch (error) {
            console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} Error fetching symbols:`, error);
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
                s.baseCurrency.includes(searchTerm)
            );
        }

        const results = filtered.map(s => {
            const searchUpper = userInput.toUpperCase();
            let score = 0;

            if (s.symbol === searchUpper) score += 1000;
            else if (s.symbol.startsWith(searchUpper)) score += 500;
            else if (s.baseCurrency === searchUpper) score += 300;
            else if (s.baseCurrency.startsWith(searchUpper)) score += 200;

            if (s.quoteCurrency === 'USDT') score += 50;
            if (s.symbol.includes('BTC') || s.symbol.includes('ETH')) score += 30;

            const baseAsset = s.baseCurrency.toLowerCase();

            return {
                symbol: s.symbol,
                full_name: `KUCOIN_SPOT:${s.symbol}`,
                description: `${s.baseCurrency}/${s.quoteCurrency} Spot`,
                exchange: KUCOIN_SPOT_CONFIG.exchange,
                type: KUCOIN_SPOT_CONFIG.type,
                exchange_logo: KUCOIN_SPOT_CONFIG.logo,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    KUCOIN_SPOT_CONFIG.logo
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, KUCOIN_SPOT_CONFIG.maxSearchResults)
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
                type: KUCOIN_SPOT_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: KUCOIN_SPOT_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: KUCOIN_SPOT_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `KUCOIN_SPOT:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    KUCOIN_SPOT_CONFIG.logo
                ]
            };
        } catch (error) {
            console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} Error resolving symbol:`, error);
            throw new Error('Symbol not found');
        }
    }

    async getSymbolPriceInfo(symbol) {
        try {
            const kucoinSymbol = symbol.replace('USDT', '-USDT');
            const response = await fetch(`${this.baseUrl}/market/orderbook/level1?symbol=${kucoinSymbol}`);
            const data = await response.json();

            if (data.code !== '200000' || !data.data) {
                return { minmov: 1, pricescale: 100 };
            }

            const price = parseFloat(data.data.price);
            return this.calculatePrecision(price);
        } catch (error) {
            console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} Error fetching price:`, error);
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
        const kucoinSymbol = symbol.replace('USDT', '-USDT');

        const intervalMap = {
            '1': '1min',
            '5': '5min',
            '15': '15min',
            '30': '30min',
            '60': '1hour',
            '240': '4hour',
            '1D': '1day',
            '1W': '1week',
            '1M': '1month'
        };
        const type = intervalMap[resolution] || '15min';

        try {
            const url = `${this.baseUrl}/market/candles?symbol=${kucoinSymbol}&type=${type}&startAt=${from}&endAt=${to}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== '200000' || !data.data || data.data.length === 0) {
                return { bars: [], meta: { noData: true } };
            }

            const bars = data.data
                .map(candle => ({
                    time: parseInt(candle[0]) * 1000,
                    open: parseFloat(candle[1]),
                    close: parseFloat(candle[2]),
                    high: parseFloat(candle[3]),
                    low: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                }))
                .reverse();

            return { bars, meta: { noData: false } };
        } catch (error) {
            console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} Error fetching bars:`, error);
            throw error;
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name;
        const kucoinSymbol = symbol.replace('USDT', '-USDT');

        const intervalMap = {
            '1': '1min',
            '5': '5min',
            '15': '15min',
            '30': '30min',
            '60': '1hour',
            '240': '4hour',
            '1D': '1day',
            '1W': '1week',
            '1M': '1month'
        };
        const interval = intervalMap[resolution] || '15min';

        // KuCoin requires token for WebSocket
        fetch(`${this.baseUrl}/bullet-public`)
            .then(res => res.json())
            .then(data => {
                if (data.code !== '200000' || !data.data) {
                    console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} Failed to get WS token`);
                    return;
                }

                const token = data.data.token;
                const endpoint = data.data.instanceServers[0].endpoint;
                const wsUrl = `${endpoint}?token=${token}`;

                const ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    const subscribeMsg = {
                        id: Date.now(),
                        type: 'subscribe',
                        topic: `/market/candles:${kucoinSymbol}_${interval}`,
                        response: true
                    };
                    ws.send(JSON.stringify(subscribeMsg));

                    // Ping every 30s
                    const pingInterval = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
                        } else {
                            clearInterval(pingInterval);
                        }
                    }, 30000);
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'message' && data.data && data.data.candles) {
                        const candle = data.data.candles;
                        onRealtimeCallback({
                            time: parseInt(candle[0]) * 1000,
                            open: parseFloat(candle[1]),
                            close: parseFloat(candle[2]),
                            high: parseFloat(candle[3]),
                            low: parseFloat(candle[4]),
                            volume: parseFloat(candle[5])
                        });
                    }
                };

                ws.onerror = (error) => {
                    console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} WebSocket error:`, error);
                };

                ws.onclose = () => {
                    console.log(`${KUCOIN_SPOT_CONFIG.logPrefix} WebSocket closed for`, symbol);
                };

                this.subscribers[subscriberUID] = ws;
            })
            .catch(error => {
                console.error(`${KUCOIN_SPOT_CONFIG.logPrefix} Error getting WS token:`, error);
            });
    }
}
