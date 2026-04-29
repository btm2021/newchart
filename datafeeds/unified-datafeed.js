/**
 * Unified Datafeed Initialization
 * Khởi tạo DatafeedManager với tất cả datasources
 */

// Wait for all scripts to load
window.initializeDatafeed = function () {
    // Check dependencies
    if (typeof DatafeedManager === 'undefined' ||
        typeof BinanceFuturesDatasource === 'undefined') {
        console.error('[Datafeed] Required classes not loaded');
        return null;
    }

    // Create manager
    const manager = new DatafeedManager();

    // Register Binance Futures (default)
    manager.registerDatasource(new BinanceFuturesDatasource(), true);

    // Register OANDA if available (Forex)
    if (typeof OANDADatasource !== 'undefined') {
        manager.registerDatasource(new OANDADatasource(), false);
        console.log('[Datafeed] OANDA datasource registered');
    }

    // Register Bybit Perpetual if available
    if (typeof BybitFuturesDatasource !== 'undefined') {
        manager.registerDatasource(new BybitFuturesDatasource(), false);
        console.log('[Datafeed] Bybit Perpetual datasource registered');
    }

    // Register OKX Perpetual if available
    if (typeof OKXFuturesDatasource !== 'undefined') {
        manager.registerDatasource(new OKXFuturesDatasource(), false);
        console.log('[Datafeed] OKX Perpetual datasource registered');
    }

    // NOTE: Spot datasources removed - only perpetual/futures supported


    // Initialize all datasources (fetch exchange info)
    manager.initialize().then(() => {
        console.log('[Datafeed] All datasources initialized');
    }).catch(error => {
        console.error('[Datafeed] Initialization error:', error);
    });

    // Store globally
    window.unifiedDatafeed = manager;

    return manager;
};

// Auto-initialize on load
window.addEventListener('load', () => {
    // Wait a bit for other scripts to parse
    setTimeout(() => {
        if (!window.unifiedDatafeed) {
            window.initializeDatafeed();
        }
    }, 100);
});

// Create unified datafeed that wraps DatafeedManager
class UnifiedDatafeed {
    constructor() {
        if (window.unifiedDatafeed) {
            this.manager = window.unifiedDatafeed;
        } else {
            this.manager = window.initializeDatafeed();
        }
    }

    onReady(callback) {
        if (this.manager) {
            this.manager.onReady(callback);
        } else {
            // Fallback to basic config
            setTimeout(() => callback({
                supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                exchanges: [
                    { value: 'BINANCE', name: 'Binance', desc: 'Binance Futures' },
                    { value: 'OANDA', name: 'OANDA', desc: 'OANDA Forex' }
                ],
                symbols_types: [
                    { name: 'Crypto', value: 'crypto' },
                    { name: 'Forex', value: 'forex' }
                ],
                supports_marks: false,
                supports_timescale_marks: false,
                supports_time: true
            }), 0);
        }
    }

    searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        if (this.manager) {
            this.manager.searchSymbols(userInput, exchange, symbolType, onResultReadyCallback);
        } else {
            onResultReadyCallback([]);
        }
    }

    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        if (this.manager) {
            this.manager.resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback);
        } else {
            onResolveErrorCallback('Datafeed not initialized');
        }
    }

    getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        if (this.manager) {
            this.manager.getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
        } else {
            onErrorCallback('Datafeed not initialized');
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        if (this.manager) {
            this.manager.subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID);
        }
    }

    unsubscribeBars(subscriberUID) {
        if (this.manager) {
            this.manager.unsubscribeBars(subscriberUID);
        }
    }
}

// Export globally
window.UnifiedDatafeed = UnifiedDatafeed;
