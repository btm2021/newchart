/**
 * Base Datasource Class
 * Abstract class định nghĩa interface chuẩn cho tất cả datasource
 */
class BaseDatasource {
    constructor(config = {}) {
        this.config = config;
        this.subscribers = {};
    }

    /**
     * Thông tin cơ bản về datasource
     */
    getInfo() {
        throw new Error('getInfo() must be implemented');
    }

    /**
     * Fetch exchange info - gọi một lần khi init
     * @returns {Promise<Array>} - Danh sách symbols với config
     */
    async fetchExchangeInfo() {
        throw new Error('fetchExchangeInfo() must be implemented');
    }

    /**
     * Search symbols trong datasource này (từ cache)
     * @param {string} userInput - Input từ user
     * @returns {Array} - Danh sách symbols
     */
    searchSymbols(userInput) {
        throw new Error('searchSymbols() must be implemented');
    }

    /**
     * Resolve symbol info
     * @param {string} symbolName - Tên symbol
     * @returns {Promise<Object>} - Symbol info
     */
    async resolveSymbol(symbolName) {
        throw new Error('resolveSymbol() must be implemented');
    }

    /**
     * Lấy historical bars
     * @param {Object} symbolInfo - Symbol info
     * @param {string} resolution - Timeframe
     * @param {Object} periodParams - {from, to, firstDataRequest}
     * @returns {Promise<Object>} - {bars, meta}
     */
    async getBars(symbolInfo, resolution, periodParams) {
        throw new Error('getBars() must be implemented');
    }

    /**
     * Subscribe realtime data
     * @param {Object} symbolInfo - Symbol info
     * @param {string} resolution - Timeframe
     * @param {Function} onRealtimeCallback - Callback khi có data mới
     * @param {string} subscriberUID - Unique ID
     */
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
        throw new Error('subscribeBars() must be implemented');
    }

    /**
     * Unsubscribe realtime data
     * @param {string} subscriberUID - Unique ID
     */
    unsubscribeBars(subscriberUID) {
        const ws = this.subscribers[subscriberUID];
        if (ws) {
            ws.close();
            delete this.subscribers[subscriberUID];
        }
    }

    /**
     * Check xem symbol có thuộc datasource này không
     * @param {string} symbolName - Tên symbol
     * @returns {boolean}
     */
    canHandle(symbolName) {
        throw new Error('canHandle() must be implemented');
    }

    /**
     * Parse symbol name từ full name
     * @param {string} fullName - Full name (VD: BINANCE:BTCUSDT)
     * @returns {string} - Symbol name
     */
    parseSymbolName(fullName) {
        const parts = fullName.split(':');
        return parts.length > 1 ? parts[1] : parts[0];
    }
}
