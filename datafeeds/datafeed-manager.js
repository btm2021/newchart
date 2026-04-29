/**
 * Datafeed Manager
 * Quản lý tất cả datasources và routing requests
 */
class DatafeedManager {
    constructor() {
        this.datasources = [];
        this.defaultDatasource = null;
        this.initialized = false;
    }

    /**
     * Register một datasource mới
     * @param {BaseDatasource} datasource - Instance của datasource
     * @param {boolean} isDefault - Set làm default datasource
     */
    registerDatasource(datasource, isDefault = false) {
        if (!(datasource instanceof BaseDatasource)) {
            throw new Error('Datasource must extend BaseDatasource');
        }

        this.datasources.push(datasource);

        if (isDefault || !this.defaultDatasource) {
            this.defaultDatasource = datasource;
        }

        console.log(`[DatafeedManager] Registered: ${datasource.getInfo().name}`);
    }

    /**
     * Initialize tất cả datasources - fetch exchangeInfo một lần
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[DatafeedManager] Initializing all datasources...');

        // Fetch tất cả exchangeInfo đồng thời
        const fetchPromises = this.datasources.map(ds =>
            ds.fetchExchangeInfo()
                .then(symbols => ({
                    datasource: ds.getInfo().id,
                    symbols: symbols,
                    success: true
                }))
                .catch(error => {
                    console.error(`[${ds.getInfo().name}] Fetch error:`, error);
                    return {
                        datasource: ds.getInfo().id,
                        symbols: [],
                        success: false
                    };
                })
        );

        const results = await Promise.all(fetchPromises);

        // Lưu vào window.symbolConfig
        if (!window.symbolConfig) {
            window.symbolConfig = {};
        }

        // All symbols list for client-side search
        this.allSymbols = [];

        results.forEach(result => {
            window.symbolConfig[result.datasource] = result.symbols;

            // Normalize and add to allSymbols
            if (Array.isArray(result.symbols)) {
                const ds = this.datasources.find(d => d.getInfo().id === result.datasource);
                const info = ds ? ds.getInfo() : {};

                const mapped = result.symbols.map(s => {
                    // Determine exchange prefix from datasource ID
                    let prefix = info.id.split('_')[0].toUpperCase();
                    if (prefix === 'OANDA') prefix = 'OANDA';

                    let fullName = `${prefix}:${s.symbol}`;
                    let description = s.description || s.symbol;
                    let base = s.baseAsset || s.baseCurrency || '';
                    let quote = s.quoteAsset || s.quoteCurrency || '';

                    if (info.id === 'OANDA') {
                        description = `${base} / ${quote}`;
                    } else {
                        description = `${base}/${quote}`;
                    }

                    return {
                        symbol: s.symbol,
                        full_name: fullName,
                        description: description,
                        exchange: info.exchange || result.datasource,
                        datasource: result.datasource, // Added for easier filtering
                        type: info.type || 'crypto',
                        base: base,
                        quote: quote,
                        original: s
                    };
                });

                this.allSymbols = this.allSymbols.concat(mapped);
            }
            console.log(`[DatafeedManager] Loaded ${result.symbols.length} symbols from ${result.datasource}`);
        });

        // Expose globally for UI
        window.allSearchableSymbols = this.allSymbols;

        this.initialized = true;
        console.log('[DatafeedManager] Initialization complete');

        // Sync to watchlist UI if available
        if (window.syncDatafeedWatchlists) {
            window.syncDatafeedWatchlists(this.allSymbols);
        } else {
            // Wait for module to load if not yet available
            setTimeout(() => {
                if (window.syncDatafeedWatchlists) {
                    window.syncDatafeedWatchlists(this.allSymbols);
                }
            }, 1000);
        }
    }

    /**
     * Mapping từ prefix sang datasource ID
     * Đây là nguồn chính để xác định datasource
     */
    static PREFIX_DATASOURCE_MAP = {
        'BINANCE': 'BINANCE_FUTURES',
        'BINANCE_FUTURES': 'BINANCE_FUTURES',
        'BYBIT': 'BYBIT_FUTURES',
        'BYBIT_FUTURES': 'BYBIT_FUTURES',
        'BYBITF': 'BYBIT_FUTURES',
        'OKX': 'OKX_FUTURES',
        'OKX_FUTURES': 'OKX_FUTURES',
        'OKXF': 'OKX_FUTURES',
        'OANDA': 'OANDA'
    };

    /**
     * Tìm datasource phù hợp cho symbol
     * @param {string} symbolName - Tên symbol (VD: BINANCE_FUTURES:BTCUSDT)
     * @returns {BaseDatasource|null}
     */
    findDatasource(symbolName) {
        const upper = symbolName.toUpperCase();

        // Priority 1: Strict prefix match using mapping
        if (upper.includes(':')) {
            const prefix = upper.split(':')[0];
            const targetDatasourceId = DatafeedManager.PREFIX_DATASOURCE_MAP[prefix];

            if (targetDatasourceId) {
                const datasource = this.datasources.find(ds => ds.getInfo().id === targetDatasourceId);
                if (datasource) {
                    console.log(`[DatafeedManager] Matched ${symbolName} -> ${targetDatasourceId}`);
                    return datasource;
                }
            }
        }

        // Priority 2: Check canHandle trên từng datasource (dựa theo prefix)
        for (const datasource of this.datasources) {
            if (datasource.canHandle(symbolName)) {
                console.log(`[DatafeedManager] canHandle matched: ${symbolName} -> ${datasource.getInfo().id}`);
                return datasource;
            }
        }

        // Priority 3: Default datasource nếu symbol không có prefix
        // Chỉ dùng cho symbols crypto không xác định (BTCUSDT)
        if (!upper.includes(':')) {
            if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('USDC')) {
                console.log(`[DatafeedManager] Using default for crypto: ${symbolName}`);
                return this.defaultDatasource;
            }
        }

        // Fallback về default
        console.log(`[DatafeedManager] Fallback to default for: ${symbolName}`);
        return this.defaultDatasource;
    }

    /**
     * TradingView onReady callback
     */
    onReady(callback) {
        const exchanges = this.datasources.map(ds => {
            const info = ds.getInfo();
            return {
                value: info.exchange,
                name: info.name,
                desc: info.description
            };
        });

        // Thêm "All Sources" option ở đầu
        exchanges.unshift({
            value: '',
            name: 'All Sources',
            desc: 'All Sources'
        });

        // Merge tất cả supported resolutions
        const allResolutions = new Set();
        this.datasources.forEach(ds => {
            ds.getInfo().supported_resolutions.forEach(r => allResolutions.add(r));
        });

        setTimeout(() => callback({
            supported_resolutions: Array.from(allResolutions).sort(),
            exchanges: exchanges,
            symbols_types: [{ name: 'Crypto', value: 'crypto' }],
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true
        }), 0);
    }

    /**
     * Parse search input để detect suffix filter
     * @param {string} userInput - Input từ user (VD: "btcusdt.p")
     * @returns {Object} - {cleanInput, targetDatasources, hasSuffix}
     */
    parseSearchInput(userInput) {
        if (!userInput) {
            return {
                cleanInput: '',
                targetDatasources: this.datasources,
                hasSuffix: false
            };
        }

        const upperInput = userInput.toUpperCase();

        // Nếu kết thúc bằng dấu chấm đơn thuần (không có suffix), remove dấu chấm
        if (upperInput.endsWith('.')) {
            return {
                cleanInput: userInput.substring(0, userInput.length - 1),
                targetDatasources: this.datasources,
                hasSuffix: true
            };
        }

        // Check từng datasource xem có suffix match không
        for (const datasource of this.datasources) {
            const info = datasource.getInfo();

            if (info.searchSuffixes) {
                for (const suffix of info.searchSuffixes) {
                    if (upperInput.endsWith(suffix)) {
                        // Remove suffix khỏi search term
                        const cleanInput = userInput.substring(0, userInput.length - suffix.length);
                        return {
                            cleanInput: cleanInput,
                            targetDatasources: [datasource],
                            hasSuffix: true
                        };
                    }
                }
            }
        }

        // Không có suffix, search tất cả
        return {
            cleanInput: userInput,
            targetDatasources: this.datasources,
            hasSuffix: false
        };
    }

    /**
     * Search symbols across all datasources (từ cache)
     * Implement thuật toán search thông minh như TradingView
     */
    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        try {
            // Parse input để detect suffix filter
            const { cleanInput, targetDatasources, hasSuffix } = this.parseSearchInput(userInput);

            let mergedResults = [];

            // Search trong datasources được filter
            for (const datasource of targetDatasources) {
                const info = datasource.getInfo();

                // Nếu có suffix hoặc exchange = '' (All Sources), ignore exchange filter
                // Nếu không có suffix và có exchange cụ thể, respect exchange filter
                if (!hasSuffix && exchange && exchange !== '' && exchange !== info.exchange) {
                    continue;
                }

                const results = datasource.searchSymbols(cleanInput);
                mergedResults = mergedResults.concat(results);
            }

            // Smart sorting
            mergedResults = this.smartSort(mergedResults, cleanInput);

            // Limit kết quả
            const finalResults = mergedResults.slice(0, 100);

            onResultReadyCallback(finalResults);

        } catch (error) {
            console.error('[DatafeedManager] Search error:', error);
            onResultReadyCallback([]);
        }
    }

    /**
     * Smart sorting algorithm
     * Ưu tiên: exact match > starts with > contains > popular pairs
     */
    smartSort(results, userInput) {
        const searchUpper = userInput.toUpperCase().trim();

        return results.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // Exact match
            if (a.symbol === searchUpper) scoreA += 10000;
            if (b.symbol === searchUpper) scoreB += 10000;

            // Starts with
            if (a.symbol.startsWith(searchUpper)) scoreA += 5000;
            if (b.symbol.startsWith(searchUpper)) scoreB += 5000;

            // Base asset match
            const baseA = a.description.split('/')[0];
            const baseB = b.description.split('/')[0];

            if (baseA === searchUpper) scoreA += 3000;
            if (baseB === searchUpper) scoreB += 3000;

            if (baseA.startsWith(searchUpper)) scoreA += 1000;
            if (baseB.startsWith(searchUpper)) scoreB += 1000;

            // Contains
            if (a.symbol.includes(searchUpper)) scoreA += 500;
            if (b.symbol.includes(searchUpper)) scoreB += 500;

            // Popular pairs bonus
            if (a.description.includes('/USDT')) scoreA += 100;
            if (b.description.includes('/USDT')) scoreB += 100;

            if (a.symbol.includes('BTC') || a.symbol.includes('ETH')) scoreA += 50;
            if (b.symbol.includes('BTC') || b.symbol.includes('ETH')) scoreB += 50;

            return scoreB - scoreA;
        });
    }

    /**
     * Resolve symbol - route đến datasource phù hợp
     */
    async resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        try {
            const datasource = this.findDatasource(symbolName);

            if (!datasource) {
                throw new Error('No datasource available for this symbol');
            }

            const symbolInfo = await datasource.resolveSymbol(symbolName);
            onSymbolResolvedCallback(symbolInfo);

        } catch (error) {
            console.error('[DatafeedManager] Resolve error:', error);
            onResolveErrorCallback(error.message || 'Symbol not found');
        }
    }

    /**
     * Get bars - route đến datasource phù hợp
     */
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        try {
            const datasource = this.findDatasource(symbolInfo.name);

            if (!datasource) {
                throw new Error('No datasource available');
            }

            const { bars, meta } = await datasource.getBars(symbolInfo, resolution, periodParams);
            onHistoryCallback(bars, meta);

        } catch (error) {
            console.error('[DatafeedManager] GetBars error:', error);
            onErrorCallback(error);
        }
    }

    /**
     * Subscribe bars - route đến datasource phù hợp
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        const datasource = this.findDatasource(symbolInfo.name);

        if (!datasource) {
            console.error('[DatafeedManager] No datasource for subscription');
            return;
        }

        // Add datasource info vào subscriberUID để unsubscribe đúng
        const fullUID = `${datasource.getInfo().id}:${subscriberUID}`;

        datasource.subscribeBars(symbolInfo, resolution, onRealtimeCallback, fullUID);
    }

    /**
     * Unsubscribe bars
     */
    unsubscribeBars(subscriberUID) {
        // Try unsubscribe từ tất cả datasources
        for (const datasource of this.datasources) {
            const fullUID = `${datasource.getInfo().id}:${subscriberUID}`;
            datasource.unsubscribeBars(fullUID);
        }
    }

    /**
     * Get danh sách tất cả datasources
     */
    getDatasources() {
        return this.datasources.map(ds => ds.getInfo());
    }
}
