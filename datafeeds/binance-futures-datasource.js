/**
 * Binance Futures Datasource Config
 */
const BINANCE_FUTURES_CONFIG = {
    id: 'BINANCE_FUTURES',
    name: 'Binance Futures',
    description: 'Binance Futures USDT Perpetual',
    exchange: 'Binance USDⓈ-M',
    logo: 'image/iconexchange/binance.svg',
    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
    type: 'crypto',
    baseUrl: 'https://fapi.binance.com/fapi/v1',
    wsUrl: 'wss://fstream.binance.com/ws',
    logPrefix: '[Binance Futures]',
    blacklistPatterns: ['DOM', '_', 'DEFI', 'BULL', 'BEAR', 'UP', 'DOWN', 'BROCCOLI', 'PUMPBTC'],
    maxSearchResults: 200,
    searchSuffixes: ['.P', '.PERP', '.F']
};

/**
 * Binance Futures Datasource
 * Implementation cho Binance Futures API
 */
class BinanceFuturesDatasource extends BaseDatasource {
    constructor(config = {}) {
        super(config);
        this.baseUrl = BINANCE_FUTURES_CONFIG.baseUrl;
        this.wsUrl = BINANCE_FUTURES_CONFIG.wsUrl;

        // Smart caching system
        this.barCache = new Map(); // Key: `${symbol}_${resolution}`, Value: { bars: [], oldestTime, newestTime }
        this.prefetchInProgress = new Map(); // Track prefetch operations
    }

    getInfo() {
        return BINANCE_FUTURES_CONFIG;
    }

    canHandle(symbolName) {
        const upper = symbolName.toUpperCase();
        // Chỉ handle khi có explicit prefix hoặc là crypto symbol không có prefix
        if (upper.startsWith('BINANCE:') || upper.startsWith('BINANCE_FUTURES:')) {
            return true;
        }
        // Không tự động claim crypto symbols - để DatafeedManager quyết định
        return false;
    }

    async fetchExchangeInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/exchangeInfo`);
            const data = await response.json();

            // Filter TRADING symbols và loại bỏ blacklist
            return data.symbols.filter(s => {
                if (s.status !== 'TRADING') return false;

                // Check blacklist patterns
                for (const pattern of BINANCE_FUTURES_CONFIG.blacklistPatterns) {
                    if (s.symbol.includes(pattern)) return false;
                }

                return true;
            });
        } catch (error) {
            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Error fetching exchangeInfo:`, error);
            return [];
        }
    }

    searchSymbols(userInput) {
        const symbols = window.symbolConfig?.[this.getInfo().id] || [];

        // Filter theo input
        let filtered = symbols;
        if (userInput && userInput.trim() !== '') {
            const searchTerm = userInput.toUpperCase();
            filtered = symbols.filter(s =>
                s.symbol.includes(searchTerm) ||
                s.baseAsset.includes(searchTerm) ||
                s.quoteAsset.includes(searchTerm)
            );
        }

        // Scoring và sorting
        const results = filtered.map(s => {
            const searchUpper = userInput.toUpperCase();
            let score = 0;
            if (s.symbol === searchUpper) score += 1000;
            else if (s.symbol.startsWith(searchUpper)) score += 500;
            else if (s.baseAsset === searchUpper) score += 300;
            else if (s.baseAsset.startsWith(searchUpper)) score += 200;

            if (s.quoteAsset === 'USDT') score += 50;
            if (s.symbol.includes('BTC') || s.symbol.includes('ETH')) score += 30;

            const baseAsset = s.baseAsset.toLowerCase()
                .replace(/^1000/, '')
                .replace(/^000/, '');

            const quoteAsset = s.quoteAsset.toLowerCase()
            return {
                symbol: s.symbol,
                full_name: `BINANCE:${s.symbol}`,
                description: `${s.baseAsset}/${s.quoteAsset}`,
                exchange: BINANCE_FUTURES_CONFIG.exchange,
                type: BINANCE_FUTURES_CONFIG.type,
                exchange_logo: BINANCE_FUTURES_CONFIG.logo,
                logo_urls: [

                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`,
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${quoteAsset}.png`
                ],
                score: score
            };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, BINANCE_FUTURES_CONFIG.maxSearchResults)
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
                .replace(/USDT|BUSD|USDC|PERP/g, '')
                .toLowerCase()
                .replace(/^1000/, '')
                .replace(/^000/, '');
            console.log(symbol)
            return {
                name: symbol,
                description: symbol,
                type: BINANCE_FUTURES_CONFIG.type,
                session: '24x7',
                timezone: 'Etc/UTC',
                ticker: symbol,
                exchange: BINANCE_FUTURES_CONFIG.exchange,
                minmov: priceInfo.minmov,
                pricescale: priceInfo.pricescale,
                has_intraday: true,
                has_daily: true,
                has_weekly_and_monthly: true,
                supported_resolutions: BINANCE_FUTURES_CONFIG.supported_resolutions,
                volume_precision: 2,
                data_status: 'streaming',
                full_name: `BINANCE:${symbol}`,
                logo_urls: [
                    `https://huobicfg.s3.amazonaws.com/currency_icon/${baseAsset}.png`
                ]
            };
        } catch (error) {
            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Error resolving symbol:`, error);
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
            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Error fetching price:`, error);
            return { minmov: 1, pricescale: 100 };
        }
    }

    calculatePrecision(price) {
        if (price === 0) {
            return { minmov: 1, pricescale: 100 };
        }

        let decimals;
        if (price >= 10000) decimals = 1;       // >= 10000: 1 số (10000.1)
        else if (price >= 100) decimals = 2;    // >= 100: 2 số (1000.01, 9999.20)
        else if (price >= 1) decimals = 3;      // >= 1: 3 số (1.123, 10.313)
        else if (price >= 0.1) decimals = 4;    // >= 0.1: 4 số (0.4312)
        else if (price >= 0.01) decimals = 5;   // >= 0.01: 5 số (0.015435)
        else if (price >= 0.001) decimals = 6;  // >= 0.001: 6 số
        else if (price >= 0.0001) decimals = 7; // >= 0.0001: 7 số
        else decimals = 8;                      // < 0.0001: 8 số

        return {
            minmov: 1,
            pricescale: Math.pow(10, decimals)
        };
    }

    async getBars(symbolInfo, resolution, periodParams) {
        const { from, to, firstDataRequest } = periodParams;
        const symbol = symbolInfo.name;
        const cacheKey = `${symbol}_${resolution}`;

        const intervalMap = {
            '1': '1m', '5': '5m', '15': '15m', '30': '30m',
            '60': '1h', '240': '4h', '1D': '1d', '1W': '1w', '1M': '1M'
        };
        const interval = intervalMap[resolution] || '15m';

        const resolutionInSeconds = {
            '1': 60, '5': 300, '15': 900, '30': 1800,
            '60': 3600, '240': 14400, '1D': 86400, '1W': 604800, '1M': 2592000
        };
        const barDuration = resolutionInSeconds[resolution] || 900;

        // Check cache first
        const cached = this.barCache.get(cacheKey);

        if (cached && cached.fullyLoaded) {
            // Return ALL bars from cache - TradingView will handle filtering
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} Served ${cached.bars.length} bars from cache`);
            return { bars: cached.bars, meta: { noData: cached.bars.length === 0 } };
        }

        // First request: load 30,000 candles immediately
        if (firstDataRequest || !cached) {
            return await this._load30kCandles(symbol, resolution, interval, barDuration, from, to, cacheKey);
        }

        // Subsequent requests: serve from cache
        // Return ALL bars - TradingView library will filter by time range
        if (cached) {
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} Served ${cached.bars.length} bars from cache (subsequent request)`);
            return { bars: cached.bars, meta: { noData: cached.bars.length === 0 } };
        }

        return { bars: [], meta: { noData: true } };
    }

    async _load30kCandles(symbol, resolution, interval, barDuration, from, to, cacheKey) {
        const prefetchKey = `${cacheKey}_loading`;

        // Show loading overlay
        this.showLoadingOverlay(symbol, resolution);

        // Prevent duplicate loading
        if (this.prefetchInProgress.get(prefetchKey)) {
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} Already loading ${symbol}, waiting...`);
            // Wait for existing load to complete
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (!this.prefetchInProgress.get(prefetchKey)) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });

            const cached = this.barCache.get(cacheKey);
            if (cached) {
                const bars = cached.bars.filter(bar => bar.time >= from * 1000 && bar.time <= to * 1000);
                this.hideLoadingOverlay();
                return { bars, meta: { noData: bars.length === 0 } };
            }
        }

        this.prefetchInProgress.set(prefetchKey, true);

        try {
            const TOTAL_CANDLES = 30000;
            const BATCH_SIZE = 1500; // Binance limit
            const NUM_BATCHES = 20; // 30000 / 1500 = 20

            const endTime = Date.now();
            const startTime = endTime - (barDuration * 1000 * TOTAL_CANDLES);

            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} 🚀 Loading 30,000 candles for ${symbol} (${resolution})`);
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} Time range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

            this.updateLoadingProgress(0, NUM_BATCHES, 0, 'Đang tải dữ liệu...');

            // Create 20 parallel requests with progress tracking
            const requests = [];
            let completedBatches = 0;
            let totalCandles = 0;

            for (let i = 0; i < NUM_BATCHES; i++) {
                const batchEndTime = endTime - (barDuration * 1000 * BATCH_SIZE * i);
                const batchStartTime = endTime - (barDuration * 1000 * BATCH_SIZE * (i + 1));

                const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${batchStartTime}&endTime=${batchEndTime}&limit=${BATCH_SIZE}`;
                requests.push(
                    fetch(url)
                        .then(res => res.json())
                        .then(data => {
                            completedBatches++;
                            const candleCount = Array.isArray(data) ? data.length : 0;
                            totalCandles += candleCount;
                            this.updateLoadingProgress(completedBatches, NUM_BATCHES, totalCandles, 'Đang tải dữ liệu...');
                            return {
                                batch: i,
                                data: data,
                                startTime: batchStartTime,
                                endTime: batchEndTime
                            };
                        })
                        .catch(err => {
                            completedBatches++;
                            this.updateLoadingProgress(completedBatches, NUM_BATCHES, totalCandles, `Lỗi batch ${i}`);
                            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Batch ${i} failed:`, err);
                            return { batch: i, data: [], error: err };
                        })
                );
            }

            // Execute all requests in parallel
            const startFetch = Date.now();
            const results = await Promise.all(requests);
            const fetchDuration = Date.now() - startFetch;

            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} ✅ Fetched 20 batches in ${fetchDuration}ms`);
            this.updateLoadingProgress(NUM_BATCHES, NUM_BATCHES, totalCandles, 'Đang xử lý dữ liệu...');

            // Combine all bars
            let allBars = [];
            let totalFetched = 0;

            for (const result of results) {
                if (Array.isArray(result.data) && result.data.length > 0) {
                    const bars = result.data.map(bar => ({
                        time: bar[0],
                        open: parseFloat(bar[1]),
                        high: parseFloat(bar[2]),
                        low: parseFloat(bar[3]),
                        close: parseFloat(bar[4]),
                        volume: parseFloat(bar[5])
                    }));
                    allBars = allBars.concat(bars);
                    totalFetched += bars.length;
                }
            }

            this.updateLoadingProgress(NUM_BATCHES, NUM_BATCHES, totalFetched, 'Đang sắp xếp và lưu cache...');

            // Sort by time and remove duplicates
            const uniqueBars = Array.from(
                new Map(allBars.map(bar => [bar.time, bar])).values()
            ).sort((a, b) => a.time - b.time);

            // Store in cache with fullyLoaded flag
            this.barCache.set(cacheKey, {
                bars: uniqueBars,
                oldestTime: uniqueBars[0]?.time || 0,
                newestTime: uniqueBars[uniqueBars.length - 1]?.time || 0,
                fullyLoaded: true,
                loadedAt: Date.now()
            });

            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} 💾 Cached ${uniqueBars.length} candles for ${symbol}`);
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} 📊 Range: ${new Date(uniqueBars[0]?.time).toISOString()} to ${new Date(uniqueBars[uniqueBars.length - 1]?.time).toISOString()}`);

            this.updateLoadingProgress(NUM_BATCHES, NUM_BATCHES, uniqueBars.length, 'Hoàn tất!');

            // Hide overlay after a short delay
            setTimeout(() => {
                this.hideLoadingOverlay();
            }, 500);

            // Return ALL bars - TradingView will handle time filtering
            // This ensures indicators have full historical data for accurate calculation
            return {
                bars: uniqueBars,
                meta: { noData: uniqueBars.length === 0 }
            };

        } catch (error) {
            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Error loading 30k candles:`, error);
            this.updateLoadingProgress(0, 20, 0, 'Lỗi tải dữ liệu!');
            setTimeout(() => {
                this.hideLoadingOverlay();
            }, 2000);
            throw error;
        } finally {
            this.prefetchInProgress.delete(prefetchKey);
        }
    }

    showLoadingOverlay(symbol, resolution) {
        const overlay = document.getElementById('data-loading-overlay');
        const symbolEl = document.getElementById('loading-symbol');

        if (overlay) {
            overlay.classList.remove('hidden');
            if (symbolEl) {
                symbolEl.textContent = `${symbol} (${resolution})`;
            }
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('data-loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    updateLoadingProgress(completed, total, candles, message) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('loading-progress');
        const candlesText = document.getElementById('loading-candles');
        const messageText = document.getElementById('loading-message');

        const percentage = (completed / total) * 100;

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${completed} / ${total}`;
        }

        if (candlesText) {
            candlesText.textContent = `${candles.toLocaleString()} nến`;
        }

        if (messageText) {
            messageText.textContent = message;
        }
    }

    async loadMoreHistoricalData(symbol, resolution, interval, barDuration, cacheKey) {
        // Load additional historical data when user scrolls back
        const cached = this.barCache.get(cacheKey);
        if (!cached) return;

        const BATCH_SIZE = 1500;
        const NUM_BATCHES = 10; // Load 15,000 more candles

        const oldestTime = cached.oldestTime;
        const prefetchKey = `${cacheKey}_history`;

        if (this.prefetchInProgress.get(prefetchKey)) return;
        this.prefetchInProgress.set(prefetchKey, true);

        try {
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} 📥 Loading 15,000 more historical candles...`);

            const requests = [];
            for (let i = 0; i < NUM_BATCHES; i++) {
                const batchEndTime = oldestTime - (barDuration * 1000 * BATCH_SIZE * i);
                const batchStartTime = oldestTime - (barDuration * 1000 * BATCH_SIZE * (i + 1));

                const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${batchStartTime}&endTime=${batchEndTime}&limit=${BATCH_SIZE}`;
                requests.push(
                    fetch(url)
                        .then(res => res.json())
                        .catch(err => {
                            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Historical batch ${i} failed:`, err);
                            return [];
                        })
                );
            }

            const results = await Promise.all(requests);

            let allBars = [];
            for (const data of results) {
                if (Array.isArray(data) && data.length > 0) {
                    const bars = data.map(bar => ({
                        time: bar[0],
                        open: parseFloat(bar[1]),
                        high: parseFloat(bar[2]),
                        low: parseFloat(bar[3]),
                        close: parseFloat(bar[4]),
                        volume: parseFloat(bar[5])
                    }));
                    allBars = allBars.concat(bars);
                }
            }

            if (allBars.length > 0) {
                // Merge with existing cache
                const combinedBars = [...allBars, ...cached.bars];
                const uniqueBars = Array.from(
                    new Map(combinedBars.map(bar => [bar.time, bar])).values()
                ).sort((a, b) => a.time - b.time);

                this.barCache.set(cacheKey, {
                    bars: uniqueBars,
                    oldestTime: uniqueBars[0].time,
                    newestTime: uniqueBars[uniqueBars.length - 1].time,
                    fullyLoaded: true,
                    loadedAt: cached.loadedAt
                });

                console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} ✅ Added ${allBars.length} historical candles (Total: ${uniqueBars.length})`);
            }
        } catch (error) {
            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} Error loading historical data:`, error);
        } finally {
            this.prefetchInProgress.delete(prefetchKey);
        }
    }

    updateRealtimeBar(symbolInfo, resolution, bar) {
        // Update cache with realtime bar
        const cacheKey = `${symbolInfo.name}_${resolution}`;
        const cached = this.barCache.get(cacheKey);

        if (!cached || !cached.fullyLoaded) return;

        // Find and update or append the bar
        const existingIndex = cached.bars.findIndex(b => b.time === bar.time);

        if (existingIndex >= 0) {
            // Update existing bar
            cached.bars[existingIndex] = bar;
        } else {
            // Append new bar
            cached.bars.push(bar);
            cached.bars.sort((a, b) => a.time - b.time);
            cached.newestTime = bar.time;
        }

        this.barCache.set(cacheKey, cached);
    }

    clearCache(symbol, resolution) {
        // Clear cache for specific symbol/resolution
        const cacheKey = symbol && resolution ? `${symbol}_${resolution}` : null;

        if (cacheKey) {
            this.barCache.delete(cacheKey);
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} 🗑️ Cleared cache for ${cacheKey}`);
        } else {
            // Clear all cache
            this.barCache.clear();
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} 🗑️ Cleared all cache`);
        }
    }

    getCacheStats() {
        // Get cache statistics
        const stats = [];
        for (const [key, value] of this.barCache.entries()) {
            stats.push({
                key,
                bars: value.bars.length,
                oldestTime: new Date(value.oldestTime).toISOString(),
                newestTime: new Date(value.newestTime).toISOString(),
                fullyLoaded: value.fullyLoaded,
                loadedAt: new Date(value.loadedAt).toISOString()
            });
        }
        return stats;
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
                const bar = {
                    time: data.k.t,
                    open: parseFloat(data.k.o),
                    high: parseFloat(data.k.h),
                    low: parseFloat(data.k.l),
                    close: parseFloat(data.k.c),
                    volume: parseFloat(data.k.v)
                };

                // Update cache with realtime data
                this.updateRealtimeBar(symbolInfo, resolution, bar);

                // Send to chart
                onRealtimeCallback(bar);
            }
        };

        ws.onerror = (error) => {
            console.error(`${BINANCE_FUTURES_CONFIG.logPrefix} WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`${BINANCE_FUTURES_CONFIG.logPrefix} WebSocket closed for`, symbol);
        };

        this.subscribers[subscriberUID] = ws;
    }
}
