/**
 * OANDA Datasource Config
 */
const OANDA_CONFIG = {
    id: 'OANDA',
    name: 'OANDA',
    description: 'OANDA Forex',
    exchange: 'OANDA',
    logo: 'image/iconexchange/oanda.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'forex',
    baseUrl: 'https://api-fxpractice.oanda.com/v3',
    streamUrl: 'https://stream-fxpractice.oanda.com/v3',
    logPrefix: '[OANDA]',
    blacklistPatterns: [],
    maxSearchResults: 400,
    searchSuffixes: ['.OA', '.OANDA'],
    // Common forex pairs
    forexPairs: [
        'XAU_USD', 'XAU_EUR', 'XAU_AUD', 'XAU_CAD', 'XAU_CHF', 'XAU_NZD', 'XAU_GBP', 'XAU_JPY',
        'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF', 'AUD_USD', 'USD_CAD', 'NZD_USD',
        'EUR_GBP', 'EUR_JPY', 'GBP_JPY', 'EUR_CHF', 'AUD_JPY', 'GBP_CHF', 'EUR_AUD',
        'EUR_CAD', 'GBP_CAD', 'AUD_CAD', 'AUD_NZD', 'CAD_JPY', 'CHF_JPY', 'NZD_JPY',
        'GBP_AUD', 'GBP_NZD', 'EUR_NZD', 'AUD_CHF', 'NZD_CHF', 'CAD_CHF', 'NZD_CAD'
    ],
    // Common stock indices
    indexInstruments: []
};

/**
 * OANDA Datasource
 * Implementation cho OANDA Forex API
 * Xử lý gap ngày nghỉ (weekend, holidays)
 */
class OANDADatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = OANDA_CONFIG.baseUrl;
        this.streamUrl = OANDA_CONFIG.streamUrl;
        this.accountId = `101-004-27015242-001`; // Demo account
        this.apiKey = `7a53c4eeff879ba6118ddc416c2d2085-4a766a7d07af7bd629c07b451fe92984`; // API key nếu có
        this.barsCache = {}; // Cache để lưu 15000 bars
    }

    getInfo() {
        return OANDA_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();

        // Check prefix
        if (upper.startsWith('OANDA:') || upper.startsWith('OA:')) {
            return true;
        }

        // Check if it's a forex pair (6 characters, all letters)
        // Examples: EURUSD, GBPJPY, AUDUSD
        const cleanSymbol = upper.replace('OANDA:', '').replace('OA:', '');

        // Manual check against lists
        const allOandaSymbols = [...OANDA_CONFIG.forexPairs, ...OANDA_CONFIG.indexInstruments];

        // Try direct match with underscore
        if (allOandaSymbols.includes(cleanSymbol)) return true;

        // Try match without underscore
        const searchPair = cleanSymbol.includes('_') ? cleanSymbol : (cleanSymbol.length === 6 ? cleanSymbol.substring(0, 3) + '_' + cleanSymbol.substring(3) : cleanSymbol);
        if (allOandaSymbols.some(s => s.replace('_', '') === cleanSymbol)) return true;

        return false;
    }

    async fetchExchangeInfo() {
        try {
            const allInstruments = [...OANDA_CONFIG.forexPairs, ...OANDA_CONFIG.indexInstruments];
            return allInstruments
                .filter(pair => {
                    for (const pattern of OANDA_CONFIG.blacklistPatterns) {
                        if (pair.includes(pattern)) return false;
                    }
                    return true;
                })
                .map(pair => {
                    const parts = pair.split('_');
                    const base = parts[0];
                    const quote = parts[1] || '';
                    return {
                        symbol: pair.replace('_', ''),
                        oandaSymbol: pair,
                        baseCurrency: base,
                        quoteCurrency: quote
                    };
                });
        } catch (error) {
            console.error(`${OANDA_CONFIG.logPrefix} Error fetching instruments:`, error);
            return [];
        }
    }

    searchSymbols(userInput) {
        const allInstruments = [...OANDA_CONFIG.forexPairs, ...OANDA_CONFIG.indexInstruments];
        const symbols = allInstruments.map(pair => {
            const parts = pair.split('_');
            const base = parts[0];
            const quote = parts[1] || '';
            const type = OANDA_CONFIG.indexInstruments.includes(pair) ? 'index' : 'forex';

            return {
                symbol: pair.replace('_', ''),
                full_name: `OANDA:${pair.replace('_', '')}`,
                description: type === 'index' ? `${base} Index` : `${base} / ${quote}`,
                exchange: OANDA_CONFIG.exchange,
                type: type,
                baseCurrency: base,
                quoteCurrency: quote,
                logo_urls: [OANDA_CONFIG.logo]
            };
        });

        let filtered = symbols;
        if (userInput && userInput.trim() !== '') {
            const searchTerm = userInput.toUpperCase().replace('_', '');
            filtered = symbols.filter(s =>
                s.symbol.includes(searchTerm) ||
                s.baseCurrency.includes(searchTerm) ||
                s.quoteCurrency.includes(searchTerm)
            );
        }

        const results = filtered.map(s => {
            const searchUpper = userInput.toUpperCase();
            let score = 0;

            if (s.symbol === searchUpper) score += 1000;
            else if (s.symbol.startsWith(searchUpper)) score += 500;
            else if (s.baseCurrency === searchUpper) score += 300;
            else if (s.baseCurrency.startsWith(searchUpper)) score += 200;

            // Major pairs bonus
            if (['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF'].includes(s.symbol)) score += 100;

            return {
                symbol: s.symbol,
                full_name: `OANDA:${s.symbol}`,
                description: `${s.baseCurrency}/${s.quoteCurrency}`,
                exchange: OANDA_CONFIG.exchange,
                type: OANDA_CONFIG.type,
                exchange_logo: OANDA_CONFIG.logo,
                logo_urls: [
                    // `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    OANDA_CONFIG.logo
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, OANDA_CONFIG.maxSearchResults)
            .map(r => {
                delete r.score;
                return r;
            });
    }

    async resolveSymbol(symbolName) {
        const symbol = this.parseSymbolName(symbolName);

        // Determine precision
        let pricescale = 100000; // Default 5 decimals for forex
        if (symbol.includes('JPY')) {
            pricescale = 1000; // 3 decimals
        } else if (symbol.includes('XAU')) {
            pricescale = 100; // 2 decimals
        } else if (symbol.includes('XAG')) {
            pricescale = 10000; // 4 decimals
        }

        try {
            return {
                name: symbol,
                description: symbol,
                type: OANDA_CONFIG.type,
                session: '0000-2400:1234567',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: OANDA_CONFIG.exchange,
                minmov: 1,
                pricescale: pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: OANDA_CONFIG.supported_resolutions,
                volume_precision: 0,
                data_status: 'streaming',
                full_name: `OANDA:${symbol}`,
                logo_urls: [
                    OANDA_CONFIG.logo
                ],
                has_no_volume: true
            };
        } catch (error) {
            console.error(`${OANDA_CONFIG.logPrefix} Error resolving symbol:`, error);
            throw new Error('Symbol not found');
        }
    }


    /**
     * Check if timestamp is in weekend (Saturday or Sunday)
     */
    isWeekend(timestamp) {
        const date = new Date(timestamp);
        const day = date.getUTCDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    }

    /**
     * Fill gaps in bars data (weekends, holidays)
     * Sử dụng giá close của bar cuối cùng trước gap
     */
    fillGaps(bars) {
        if (bars.length === 0) return bars;

        const filledBars = [];
        const barInterval = bars.length > 1 ? bars[1].time - bars[0].time : 86400000; // Default 1 day

        for (let i = 0; i < bars.length; i++) {
            filledBars.push(bars[i]);

            // Check gap với bar tiếp theo
            if (i < bars.length - 1) {
                const currentTime = bars[i].time;
                const nextTime = bars[i + 1].time;
                const gap = nextTime - currentTime;

                // Nếu gap > 2x interval, fill với flat bars
                if (gap > barInterval * 2) {
                    const lastClose = bars[i].close;
                    let fillTime = currentTime + barInterval;

                    while (fillTime < nextTime) {
                        // Chỉ fill nếu không phải weekend
                        if (!this.isWeekend(fillTime)) {
                            filledBars.push({
                                time: fillTime,
                                open: lastClose,
                                high: lastClose,
                                low: lastClose,
                                close: lastClose,
                                volume: 0
                            });
                        }
                        fillTime += barInterval;
                    }
                }
            }
        }

        return filledBars;
    }

    /**
     * Fetch 5000 bars từ OANDA API
     */
    async fetchBatch(oandaSymbol, granularity, toTime) {
        const toISO = new Date(toTime * 1000).toISOString();
        const url = `${this.baseUrl}/instruments/${oandaSymbol}/candles?granularity=${granularity}&to=${toISO}&count=5000&price=M`;

        const headers = {};
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(url, { headers });
        const data = await response.json();

        if (data.errorMessage) {
            throw new Error(data.errorMessage);
        }

        if (!data.candles || data.candles.length === 0) {
            return [];
        }

        return data.candles
            .map(candle => ({
                time: new Date(candle.time).getTime(),
                open: parseFloat(candle.mid.o),
                high: parseFloat(candle.mid.h),
                low: parseFloat(candle.mid.l),
                close: parseFloat(candle.mid.c),
                volume: candle.volume || 0
            }));
    }

    /**
     * Lấy 5000 bars và cache lại
     */
    async fetch5000Bars(symbol, oandaSymbol, resolution) {
        const cacheKey = `${symbol}_${resolution}`;

        // Kiểm tra cache (cache 5 phút)
        const cached = this.barsCache[cacheKey];
        if (cached && Date.now() - cached.timestamp < 300000) {
            console.log(`${OANDA_CONFIG.logPrefix} Using cached data for ${symbol} (${resolution})`);
            return cached.bars;
        }

        const intervalMap = {
            '1': 'M1',
            '5': 'M5',
            '15': 'M15',
            '30': 'M30',
            '60': 'H1',
            '240': 'H4',
            '1D': 'D',
            '1W': 'W',
            '1M': 'M'
        };
        const granularity = intervalMap[resolution] || 'H1';

        console.log(`${OANDA_CONFIG.logPrefix} Fetching 5000 bars for ${symbol} (${resolution})...`);

        try {
            const now = Math.floor(Date.now() / 1000);

            // Lấy 5000 bars gần nhất
            const bars = await this.fetchBatch(oandaSymbol, granularity, now);

            console.log(`${OANDA_CONFIG.logPrefix} Fetched: ${bars.length} bars`);

            // Cache lại
            this.barsCache[cacheKey] = {
                bars: bars,
                timestamp: Date.now()
            };

            return bars;
        } catch (error) {
            console.error(`${OANDA_CONFIG.logPrefix} Error fetching 5000 bars:`, error);
            return [];
        }
    }

    async getBars(symbolInfo, resolution, periodParams) {
        const { from, to } = periodParams;
        const symbol = symbolInfo.name;

        // Map symbol to OANDA format (e.g. EURUSD -> EUR_USD)
        const allInstruments = [...OANDA_CONFIG.forexPairs, ...OANDA_CONFIG.indexInstruments];
        const match = allInstruments.find(s => s.replace('_', '') === symbol);
        const oandaSymbol = match || symbol;

        try {
            // Đảm bảo 'to' không vượt quá thời gian hiện tại
            const now = Math.floor(Date.now() / 1000);
            const adjustedTo = Math.min(to, now - 5);

            if (from > adjustedTo) {
                return { bars: [], meta: { noData: true } };
            }

            // Lấy 5000 bars từ cache hoặc API
            const allBars = await this.fetch5000Bars(symbol, oandaSymbol, resolution);

            if (allBars.length === 0) {
                console.log(`${OANDA_CONFIG.logPrefix} No bars available for ${symbol}`);
                return { bars: [], meta: { noData: true } };
            }

            // Lọc bars trong khoảng thời gian yêu cầu
            let bars = allBars.filter(bar => {
                const barTimeSec = Math.floor(bar.time / 1000);
                return barTimeSec >= from && barTimeSec <= adjustedTo;
            });

            // Nếu không có bars trong range (ví dụ: weekend/holiday)
            // Tìm bars gần nhất TRƯỚC khoảng thời gian yêu cầu
            if (bars.length === 0) {
                console.log(`${OANDA_CONFIG.logPrefix} No bars in range, finding nearest bars before ${from}`);

                // Tìm bars có time < from
                const barsBefore = allBars.filter(bar => {
                    const barTimeSec = Math.floor(bar.time / 1000);
                    return barTimeSec < from;
                });

                if (barsBefore.length > 0) {
                    // Lấy 50 bars gần nhất trước khoảng thời gian yêu cầu
                    bars = barsBefore.slice(-50);
                    console.log(`${OANDA_CONFIG.logPrefix} Returning ${bars.length} bars before requested range`);
                } else {
                    // Nếu không có bars trước đó, lấy bars đầu tiên
                    bars = allBars.slice(0, 50);
                    console.log(`${OANDA_CONFIG.logPrefix} Returning first ${bars.length} bars available`);
                }
            }

            // Fill gaps cho daily và higher timeframes
            if (['1D', '1W', '1M'].includes(resolution)) {
                bars = this.fillGaps(bars);
            }

            console.log(`${OANDA_CONFIG.logPrefix} Returning ${bars.length} bars for ${symbol} (${resolution})`);
            return { bars, meta: { noData: false } };
        } catch (error) {
            console.error(`${OANDA_CONFIG.logPrefix} Error in getBars:`, error);
            return { bars: [], meta: { noData: true } };
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const symbol = symbolInfo.name;
        const allInstruments = [...OANDA_CONFIG.forexPairs, ...OANDA_CONFIG.indexInstruments];
        const match = allInstruments.find(s => s.replace('_', '') === symbol);
        const oandaSymbol = match || symbol;

        console.log(`${OANDA_CONFIG.logPrefix} Subscribing to ${oandaSymbol} (${resolution})`);

        const intervalMap = {
            '1': 60000,
            '5': 300000,
            '15': 900000,
            '30': 1800000,
            '60': 3600000,
            '240': 14400000,
            '1D': 86400000,
            '1W': 604800000,
            '1M': 2592000000
        };
        const interval = intervalMap[resolution] || 3600000;

        let lastBar = null;
        let abortController = new AbortController();
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const connectStream = () => {
            const streamUrl = `${this.streamUrl}/accounts/${this.accountId}/pricing/stream?instruments=${oandaSymbol}`;
            const headers = { 'Accept': 'application/json' };
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            fetch(streamUrl, {
                headers: headers,
                signal: abortController.signal
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    reconnectAttempts = 0;
                    console.log(`${OANDA_CONFIG.logPrefix} Stream connected for ${oandaSymbol}`);

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    const processStream = () => {
                        reader.read().then(({ done, value }) => {
                            if (done) {
                                console.log(`${OANDA_CONFIG.logPrefix} Stream ended for ${oandaSymbol}`);
                                if (reconnectAttempts < maxReconnectAttempts) {
                                    reconnectAttempts++;
                                    console.log(`${OANDA_CONFIG.logPrefix} Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`);
                                    setTimeout(connectStream, 2000 * reconnectAttempts);
                                }
                                return;
                            }

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.trim() === '') continue;

                                try {
                                    const data = JSON.parse(line);

                                    if (data.type === 'PRICE') {
                                        const bidPrice = parseFloat(data.bids?.[0]?.price || data.closeoutBid);
                                        const askPrice = parseFloat(data.asks?.[0]?.price || data.closeoutAsk);

                                        if (!bidPrice || !askPrice) continue;

                                        const price = (bidPrice + askPrice) / 2;
                                        const timestamp = new Date(data.time).getTime();
                                        const barTime = Math.floor(timestamp / interval) * interval;

                                        if (!lastBar || lastBar.time !== barTime) {
                                            if (lastBar) {
                                                console.log(`${OANDA_CONFIG.logPrefix} New bar: ${new Date(barTime).toISOString()} O:${lastBar.open} H:${lastBar.high} L:${lastBar.low} C:${lastBar.close}`);
                                                onRealtimeCallback(lastBar);
                                            }
                                            lastBar = {
                                                time: barTime,
                                                open: price,
                                                high: price,
                                                low: price,
                                                close: price,
                                                volume: 0
                                            };
                                        } else {
                                            lastBar.high = Math.max(lastBar.high, price);
                                            lastBar.low = Math.min(lastBar.low, price);
                                            lastBar.close = price;
                                            onRealtimeCallback(lastBar);
                                        }
                                    } else if (data.type === 'HEARTBEAT') {
                                        console.log(`${OANDA_CONFIG.logPrefix} Heartbeat received`);
                                    }
                                } catch (error) {
                                    console.error(`${OANDA_CONFIG.logPrefix} Parse error:`, error.message);
                                }
                            }

                            processStream();
                        }).catch(error => {
                            if (error.name !== 'AbortError') {
                                console.error(`${OANDA_CONFIG.logPrefix} Read error:`, error);
                                if (reconnectAttempts < maxReconnectAttempts) {
                                    reconnectAttempts++;
                                    setTimeout(connectStream, 2000 * reconnectAttempts);
                                }
                            }
                        });
                    };

                    processStream();
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error(`${OANDA_CONFIG.logPrefix} Connection error:`, error);
                        if (reconnectAttempts < maxReconnectAttempts) {
                            reconnectAttempts++;
                            setTimeout(connectStream, 2000 * reconnectAttempts);
                        }
                    }
                });
        };

        connectStream();

        this.subscribers[subscriberUID] = {
            close: () => {
                abortController.abort();
                console.log(`${OANDA_CONFIG.logPrefix} Unsubscribed ${subscriberUID}`);
            }
        };
    }

    unsubscribeBars(subscriberUID) {
        const subscriber = this.subscribers[subscriberUID];
        if (subscriber && subscriber.close) {
            subscriber.close();
            delete this.subscribers[subscriberUID];
        }
    }
}
