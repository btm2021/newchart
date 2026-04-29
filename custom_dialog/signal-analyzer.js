// Signal Analyzer Dialog - Dashboard phân tích toàn diện
class SignalAnalyzerDialog extends DialogBase {
    constructor() {
        super({
            id: 'signal-analyzer',
            title: 'Signal Analyzer - Dashboard Phân Tích',
            width: '95vw',
            maxHeight: '95vh'
        });
        
        this.symbol = '';
        this.candles = [];
        this.marketData = null;
        this.indicators = null;
        this.orderbook = null;
        this.ws = null;
        this.priceWs = null;
        this.orderbookWs = null;
        this.precision = 2;
        this.updateInterval = null;
    }

    create() {
        super.create();
        this.renderContent();
        return this;
    }

    show() {
        super.show();
        setTimeout(() => {
            this.symbol = this.getCurrentSymbol();
            document.getElementById('analyzer-symbol').value = this.symbol;
            this.analyze();
        }, 100);
        return this;
    }

    renderContent() {
        const content = document.createElement('div');
        content.className = 'analyzer-dashboard';
        
        // Header Controls
        const header = document.createElement('div');
        header.className = 'analyzer-header';
        
        const symbolInput = this.createInput({
            id: 'analyzer-symbol',
            type: 'text',
            placeholder: 'BTCUSDT',
            value: this.getCurrentSymbol()
        });
        
        const timeframeSelect = this.createSelect({
            id: 'analyzer-timeframe',
            options: [
                { value: '1m', label: '1m' },
                { value: '5m', label: '5m' },
                { value: '15m', label: '15m', selected: true },
                { value: '30m', label: '30m' },
                { value: '1h', label: '1h' },
                { value: '4h', label: '4h' },
                { value: '1d', label: '1d' }
            ]
        });
        
        const analyzeBtn = this.createButton('Phân Tích', {
            variant: 'primary',
            onClick: () => this.analyze()
        });
        
        header.innerHTML = `
            <div class="analyzer-controls">
                <div class="control-group">
                    <label>Symbol</label>
                </div>
                <div class="control-group">
                    <label>Timeframe</label>
                </div>
                <div class="control-group">
                </div>
            </div>
        `;
        
        header.querySelector('.control-group:nth-child(1)').appendChild(symbolInput);
        header.querySelector('.control-group:nth-child(2)').appendChild(timeframeSelect);
        header.querySelector('.control-group:nth-child(3)').appendChild(analyzeBtn);
        
        content.appendChild(header);
        
        // Main Dashboard - 2 columns
        const dashboard = document.createElement('div');
        dashboard.className = 'analyzer-main';
        dashboard.innerHTML = `
            <div class="analyzer-left">
                <!-- Market Info -->
                <div class="info-section" id="market-info-section">
                    <h3>Thông Tin Thị Trường</h3>
                    <div class="loading-text">Đang tải...</div>
                </div>
                
                <!-- Orderbook -->
                <div class="info-section" id="orderbook-section">
                    <h3>Order Book</h3>
                    <div class="loading-text">Đang tải...</div>
                </div>
            </div>
            
            <div class="analyzer-right">
                <!-- Signal Gauge -->
                <div class="info-section" id="signal-section">
                    <h3>Tín Hiệu Giao Dịch</h3>
                    <div class="loading-text">Đang tải...</div>
                </div>
                
                <!-- Technical Indicators -->
                <div class="info-section" id="indicators-section">
                    <h3>Chỉ Báo Kỹ Thuật</h3>
                    <div class="loading-text">Đang tải...</div>
                </div>
                
                <!-- Signal Details -->
                <div class="info-section" id="signals-detail-section">
                    <h3>Chi Tiết Tín Hiệu</h3>
                    <div class="loading-text">Đang tải...</div>
                </div>
            </div>
        `;
        
        content.appendChild(dashboard);
        this.setContent(content);
    }

    getCurrentSymbol() {
        try {
            if (typeof tvWidget !== 'undefined' && tvWidget && tvWidget.chart) {
                const fullSymbol = tvWidget.chart().symbol();
                const parts = fullSymbol.split(':');
                return parts.length > 1 ? parts[1] : parts[0];
            }
        } catch (error) {
            console.error('Error getting current symbol:', error);
        }
        return 'BTCUSDT';
    }

    async analyze() {
        this.symbol = document.getElementById('analyzer-symbol').value.toUpperCase();
        const timeframe = document.getElementById('analyzer-timeframe').value;
        
        if (!this.symbol) {
            alert('Vui lòng nhập symbol');
            return;
        }
        
        try {
            // Show loading
            this.showLoading();
            
            // Fetch all data in parallel
            await Promise.all([
                this.fetchMarketData(),
                this.fetchCandles(timeframe),
                this.fetchOrderbook(),
                this.fetchLongShortRatio(),
                this.fetchOpenInterest()
            ]);
            
            // Calculate indicators
            this.calculateIndicators();
            
            // Render all sections
            this.renderMarketInfo();
            this.renderOrderbook();
            this.renderSignalGauge();
            this.renderIndicators();
            this.renderSignalDetails();
            
            // Start realtime updates
            this.startRealtimeUpdates();
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Lỗi: ' + error.message);
        }
    }

    showLoading() {
        const sections = ['market-info-section', 'orderbook-section', 'signal-section', 
                         'indicators-section', 'signals-detail-section'];
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) {
                const content = section.querySelector('div:not(h3)') || section;
                content.innerHTML = '<div class="loading-text">Đang tải...</div>';
            }
        });
    }

    async fetchMarketData() {
        // Fetch 24hr ticker
        const ticker = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${this.symbol}`);
        const tickerData = await ticker.json();
        
        // Fetch funding rate
        const funding = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${this.symbol}`);
        const fundingData = await funding.json();
        
        // Get precision
        const exchangeInfo = await fetch(`https://fapi.binance.com/fapi/v1/exchangeInfo`);
        const exchangeData = await exchangeInfo.json();
        const symbolInfo = exchangeData.symbols.find(s => s.symbol === this.symbol);
        
        if (symbolInfo) {
            this.precision = symbolInfo.pricePrecision;
        }
        
        this.marketData = {
            ...tickerData,
            fundingRate: parseFloat(fundingData.lastFundingRate),
            nextFundingTime: fundingData.nextFundingTime,
            markPrice: parseFloat(fundingData.markPrice),
            indexPrice: parseFloat(fundingData.indexPrice)
        };
    }

    async fetchCandles(timeframe) {
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${this.symbol}&interval=${timeframe}&limit=500`;
        const response = await fetch(url);
        const data = await response.json();
        
        this.candles = data.map(candle => ({
            time: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    }

    async fetchOrderbook() {
        const url = `https://fapi.binance.com/fapi/v1/depth?symbol=${this.symbol}&limit=20`;
        const response = await fetch(url);
        this.orderbook = await response.json();
        
        // Start WebSocket for orderbook
        this.startOrderbookWebSocket();
    }

    startOrderbookWebSocket() {
        // Close existing orderbook WebSocket
        if (this.orderbookWs) {
            this.orderbookWs.close();
        }
        
        const wsSymbol = this.symbol.toLowerCase();
        this.orderbookWs = new WebSocket(`wss://fstream.binance.com/ws/${wsSymbol}@depth20@100ms`);
        
        this.orderbookWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.orderbook = {
                    bids: data.b || data.bids,
                    asks: data.a || data.asks
                };
                this.renderOrderbook();
            } catch (error) {
                console.error('Orderbook WebSocket error:', error);
            }
        };
        
        this.orderbookWs.onerror = (error) => {
            console.error('Orderbook WebSocket connection error:', error);
        };
        
        this.orderbookWs.onclose = () => {
            console.log('Orderbook WebSocket closed');
        };
    }

    async fetchLongShortRatio() {
        try {
            const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${this.symbol}&period=5m&limit=1`;
            const response = await fetch(url);
            const data = await response.json();
            if (data && data.length > 0) {
                this.longShortRatio = {
                    longAccount: parseFloat(data[0].longAccount),
                    shortAccount: parseFloat(data[0].shortAccount),
                    longShortRatio: parseFloat(data[0].longShortRatio)
                };
            }
        } catch (error) {
            console.error('Error fetching long/short ratio:', error);
        }
    }

    async fetchOpenInterest() {
        try {
            const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${this.symbol}`;
            const response = await fetch(url);
            const data = await response.json();
            this.openInterest = parseFloat(data.openInterest);
        } catch (error) {
            console.error('Error fetching open interest:', error);
        }
    }

    calculateIndicators() {
        const ema20 = this.calculateEMA(this.candles, 20);
        const ema50 = this.calculateEMA(this.candles, 50);
        const ema200 = this.calculateEMA(this.candles, 200);
        const rsi = this.calculateRSI(this.candles, 14);
        const vwap = this.calculateVWAP(this.candles);
        
        const lastCandle = this.candles[this.candles.length - 1];
        
        this.indicators = {
            price: lastCandle.close,
            ema20: ema20[ema20.length - 1],
            ema50: ema50[ema50.length - 1],
            ema200: ema200[ema200.length - 1],
            rsi: rsi[rsi.length - 1],
            vwap: vwap[vwap.length - 1]
        };
        
        // Calculate signals
        this.calculateSignals();
    }

    calculateSignals() {
        let buySignals = 0;
        let sellSignals = 0;
        let signals = [];
        
        const price = this.indicators.price;
        const { ema20, ema50, ema200, rsi, vwap } = this.indicators;
        
        // EMA Analysis
        if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
            buySignals += 3;
            signals.push({ indicator: 'EMA', signal: 'BUY', strength: 3, reason: 'Giá trên EMA20 > EMA50 > EMA200 (Uptrend mạnh)' });
        } else if (price < ema20 && ema20 < ema50 && ema50 < ema200) {
            sellSignals += 3;
            signals.push({ indicator: 'EMA', signal: 'SELL', strength: 3, reason: 'Giá dưới EMA20 < EMA50 < EMA200 (Downtrend mạnh)' });
        } else if (price > ema20) {
            buySignals += 1;
            signals.push({ indicator: 'EMA', signal: 'BUY', strength: 1, reason: 'Giá trên EMA20' });
        } else {
            sellSignals += 1;
            signals.push({ indicator: 'EMA', signal: 'SELL', strength: 1, reason: 'Giá dưới EMA20' });
        }
        
        // RSI Analysis
        if (rsi < 30) {
            buySignals += 2;
            signals.push({ indicator: 'RSI', signal: 'BUY', strength: 2, reason: `RSI ${rsi.toFixed(2)} < 30 (Oversold)` });
        } else if (rsi > 70) {
            sellSignals += 2;
            signals.push({ indicator: 'RSI', signal: 'SELL', strength: 2, reason: `RSI ${rsi.toFixed(2)} > 70 (Overbought)` });
        } else if (rsi > 50) {
            buySignals += 1;
            signals.push({ indicator: 'RSI', signal: 'BUY', strength: 1, reason: `RSI ${rsi.toFixed(2)} > 50 (Bullish)` });
        } else {
            sellSignals += 1;
            signals.push({ indicator: 'RSI', signal: 'SELL', strength: 1, reason: `RSI ${rsi.toFixed(2)} < 50 (Bearish)` });
        }
        
        // VWAP Analysis
        if (price > vwap) {
            buySignals += 2;
            signals.push({ indicator: 'VWAP', signal: 'BUY', strength: 2, reason: 'Giá trên VWAP (Bullish)' });
        } else {
            sellSignals += 2;
            signals.push({ indicator: 'VWAP', signal: 'SELL', strength: 2, reason: 'Giá dưới VWAP (Bearish)' });
        }
        
        const totalSignals = buySignals + sellSignals;
        const buyPercentage = (buySignals / totalSignals) * 100;
        const sellPercentage = (sellSignals / totalSignals) * 100;
        
        let finalSignal = 'NOTHING';
        if (buyPercentage >= 60) finalSignal = 'BUY';
        else if (sellPercentage >= 60) finalSignal = 'SELL';
        
        this.signals = {
            list: signals,
            buySignals,
            sellSignals,
            buyPercentage,
            sellPercentage,
            finalSignal
        };
    }

    renderMarketInfo() {
        const section = document.getElementById('market-info-section');
        if (!section) return;
        
        const content = section.querySelector('div:not(h3)') || section;
        const data = this.marketData;
        
        const priceChange = parseFloat(data.priceChange);
        const priceChangePercent = parseFloat(data.priceChangePercent);
        const changeClass = priceChange >= 0 ? 'positive' : 'negative';
        const changeSign = priceChange >= 0 ? '+' : '';
        
        const fundingClass = data.fundingRate >= 0 ? 'positive' : 'negative';
        const fundingSign = data.fundingRate >= 0 ? '+' : '';
        
        const longShortHtml = this.longShortRatio ? `
            <div class="info-row">
                <span class="info-label">Long/Short Ratio:</span>
                <span class="info-value">${this.longShortRatio.longShortRatio.toFixed(4)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Long Account:</span>
                <span class="info-value positive">${(this.longShortRatio.longAccount * 100).toFixed(2)}%</span>
            </div>
            <div class="info-row">
                <span class="info-label">Short Account:</span>
                <span class="info-value negative">${(this.longShortRatio.shortAccount * 100).toFixed(2)}%</span>
            </div>
        ` : '';
        
        const openInterestHtml = this.openInterest ? `
            <div class="info-row">
                <span class="info-label">Open Interest:</span>
                <span class="info-value">${this.formatNumber(this.openInterest)}</span>
            </div>
        ` : '';
        
        content.innerHTML = `
            <div class="market-info-grid">
                <div class="price-display">
                    <div class="price-label">Last Price</div>
                    <div class="price-value" id="realtime-price">${this.formatPrice(parseFloat(data.lastPrice))}</div>
                    <div class="price-change ${changeClass}">
                        ${changeSign}${this.formatPrice(priceChange)} (${changeSign}${priceChangePercent.toFixed(2)}%)
                    </div>
                </div>
                
                <div class="info-grid">
                    <div class="info-row">
                        <span class="info-label">Mark Price:</span>
                        <span class="info-value">${this.formatPrice(data.markPrice)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Index Price:</span>
                        <span class="info-value">${this.formatPrice(data.indexPrice)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">24h High:</span>
                        <span class="info-value">${this.formatPrice(parseFloat(data.highPrice))}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">24h Low:</span>
                        <span class="info-value">${this.formatPrice(parseFloat(data.lowPrice))}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">24h Volume:</span>
                        <span class="info-value">${this.formatVolume(parseFloat(data.volume))}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">24h Quote Volume:</span>
                        <span class="info-value">${this.formatVolume(parseFloat(data.quoteVolume))}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Funding Rate:</span>
                        <span class="info-value ${fundingClass}">${fundingSign}${(data.fundingRate * 100).toFixed(4)}%</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">24h Trades:</span>
                        <span class="info-value">${this.formatNumber(parseInt(data.count))}</span>
                    </div>
                    ${longShortHtml}
                    ${openInterestHtml}
                </div>
            </div>
        `;
    }

    renderOrderbook() {
        const section = document.getElementById('orderbook-section');
        if (!section || !this.orderbook) return;
        
        const content = section.querySelector('div:not(h3)') || section;
        
        const bids = this.orderbook.bids.slice(0, 15);
        const asks = this.orderbook.asks.slice(0, 15).reverse();
        
        // Calculate max volume for bar width
        const allOrders = [...bids, ...asks];
        const maxVolume = Math.max(...allOrders.map(o => parseFloat(o[1])));
        
        // Calculate total volumes
        const totalBidVolume = bids.reduce((sum, bid) => sum + parseFloat(bid[1]), 0);
        const totalAskVolume = asks.reduce((sum, ask) => sum + parseFloat(ask[1]), 0);
        const totalVolume = totalBidVolume + totalAskVolume;
        const bidPercentage = (totalBidVolume / totalVolume * 100).toFixed(1);
        const askPercentage = (totalAskVolume / totalVolume * 100).toFixed(1);
        
        const bidsHtml = bids.map(bid => {
            const price = parseFloat(bid[0]);
            const volume = parseFloat(bid[1]);
            const total = price * volume;
            const barWidth = (volume / maxVolume) * 100;
            
            return `
                <div class="orderbook-row-h buy">
                    <div class="orderbook-bar-h" style="width: ${barWidth}%"></div>
                    <div class="orderbook-price-h">${this.formatPrice(price)}</div>
                    <div class="orderbook-volume-h">${volume.toFixed(3)}</div>
                </div>
            `;
        }).join('');
        
        const asksHtml = asks.map(ask => {
            const price = parseFloat(ask[0]);
            const volume = parseFloat(ask[1]);
            const total = price * volume;
            const barWidth = (volume / maxVolume) * 100;
            
            return `
                <div class="orderbook-row-h sell">
                    <div class="orderbook-bar-h" style="width: ${barWidth}%"></div>
                    <div class="orderbook-price-h">${this.formatPrice(price)}</div>
                    <div class="orderbook-volume-h">${volume.toFixed(3)}</div>
                </div>
            `;
        }).join('');
        
        const spread = parseFloat(asks[0][0]) - parseFloat(bids[0][0]);
        const spreadPercent = (spread / parseFloat(bids[0][0]) * 100).toFixed(3);
        
        content.innerHTML = `
            <div class="orderbook-horizontal">
                <div class="orderbook-stats">
                    <div class="orderbook-stat buy">
                        <div class="stat-label">Bids</div>
                        <div class="stat-value">${bidPercentage}%</div>
                        <div class="stat-volume">${this.formatVolume(totalBidVolume)}</div>
                    </div>
                    <div class="orderbook-stat spread">
                        <div class="stat-label">Spread</div>
                        <div class="stat-value">${this.formatPrice(spread)}</div>
                        <div class="stat-volume">${spreadPercent}%</div>
                    </div>
                    <div class="orderbook-stat sell">
                        <div class="stat-label">Asks</div>
                        <div class="stat-value">${askPercentage}%</div>
                        <div class="stat-volume">${this.formatVolume(totalAskVolume)}</div>
                    </div>
                </div>
                
                <div class="orderbook-grid-h">
                    <div class="orderbook-side-h bids-side">
                        <div class="orderbook-side-header">
                            <span class="header-price">Price (USDT)</span>
                            <span class="header-amount">Amount</span>
                        </div>
                        <div class="orderbook-rows-h">
                            ${bidsHtml}
                        </div>
                    </div>
                    
                    <div class="orderbook-side-h asks-side">
                        <div class="orderbook-side-header">
                            <span class="header-price">Price (USDT)</span>
                            <span class="header-amount">Amount</span>
                        </div>
                        <div class="orderbook-rows-h">
                            ${asksHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSignalGauge() {
        const section = document.getElementById('signal-section');
        if (!section) return;
        
        const content = section.querySelector('div:not(h3)') || section;
        
        content.innerHTML = `
            <div class="signal-gauge-wrapper">
                <canvas id="signal-gauge" width="300" height="200"></canvas>
            </div>
            <div class="signal-result">
                <div class="signal-badge ${this.signals.finalSignal.toLowerCase()}">${this.signals.finalSignal}</div>
                <div class="signal-percentages">
                    <span class="buy-percent">BUY: ${this.signals.buyPercentage.toFixed(1)}%</span>
                    <span class="sell-percent">SELL: ${this.signals.sellPercentage.toFixed(1)}%</span>
                </div>
            </div>
        `;
        
        setTimeout(() => this.drawGauge(), 100);
    }

    renderIndicators() {
        const section = document.getElementById('indicators-section');
        if (!section) return;
        
        const content = section.querySelector('div:not(h3)') || section;
        
        content.innerHTML = `
            <div class="indicators-grid">
                <div class="indicator-item">
                    <div class="indicator-label">Current Price</div>
                    <div class="indicator-value">${this.formatPrice(this.indicators.price)}</div>
                </div>
                <div class="indicator-item">
                    <div class="indicator-label">EMA 20</div>
                    <div class="indicator-value">${this.formatPrice(this.indicators.ema20)}</div>
                </div>
                <div class="indicator-item">
                    <div class="indicator-label">EMA 50</div>
                    <div class="indicator-value">${this.formatPrice(this.indicators.ema50)}</div>
                </div>
                <div class="indicator-item">
                    <div class="indicator-label">EMA 200</div>
                    <div class="indicator-value">${this.formatPrice(this.indicators.ema200)}</div>
                </div>
                <div class="indicator-item">
                    <div class="indicator-label">RSI (14)</div>
                    <div class="indicator-value">${this.indicators.rsi.toFixed(2)}</div>
                </div>
                <div class="indicator-item">
                    <div class="indicator-label">VWAP</div>
                    <div class="indicator-value">${this.formatPrice(this.indicators.vwap)}</div>
                </div>
            </div>
        `;
    }

    renderSignalDetails() {
        const section = document.getElementById('signals-detail-section');
        if (!section) return;
        
        const content = section.querySelector('div:not(h3)') || section;
        
        const signalsHtml = this.signals.list.map(signal => `
            <div class="signal-detail-item ${signal.signal.toLowerCase()}">
                <div class="signal-detail-header">
                    <span class="signal-detail-indicator">${signal.indicator}</span>
                    <span class="signal-detail-badge ${signal.signal.toLowerCase()}">${signal.signal}</span>
                    <span class="signal-detail-strength">★ ${signal.strength}</span>
                </div>
                <div class="signal-detail-reason">${signal.reason}</div>
            </div>
        `).join('');
        
        content.innerHTML = `<div class="signals-detail-list">${signalsHtml}</div>`;
    }

    drawGauge() {
        const canvas = document.getElementById('signal-gauge');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height - 15;
        const radius = 80;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
        ctx.strokeStyle = '#2A2E39';
        ctx.lineWidth = 15;
        ctx.stroke();
        
        // SELL zone (red)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + (Math.PI * 0.4));
        ctx.strokeStyle = '#F23645';
        ctx.lineWidth = 15;
        ctx.stroke();
        
        // NOTHING zone (yellow)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI + (Math.PI * 0.4), Math.PI + (Math.PI * 0.6));
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 15;
        ctx.stroke();
        
        // BUY zone (green)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI + (Math.PI * 0.6), 2 * Math.PI);
        ctx.strokeStyle = '#089981';
        ctx.lineWidth = 15;
        ctx.stroke();
        
        // Needle
        const angle = Math.PI + (Math.PI * (this.signals.buyPercentage / 100));
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        const needleX = centerX + (radius - 20) * Math.cos(angle);
        const needleY = centerY + (radius - 20) * Math.sin(angle);
        ctx.lineTo(needleX, needleY);
        ctx.strokeStyle = '#D1D4DC';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#D1D4DC';
        ctx.fill();
        
        // Labels
        ctx.fillStyle = '#D1D4DC';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SELL', centerX - 60, centerY + 5);
        ctx.fillText('NOTHING', centerX, centerY - 60);
        ctx.fillText('BUY', centerX + 60, centerY + 5);
    }

    startRealtimeUpdates() {
        // Close existing connections
        if (this.priceWs) this.priceWs.close();
        
        // Subscribe to price updates via WebSocket
        const wsSymbol = this.symbol.toLowerCase();
        this.priceWs = new WebSocket(`wss://fstream.binance.com/ws/${wsSymbol}@markPrice`);
        
        this.priceWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const markPrice = parseFloat(data.p);
                
                const priceElement = document.getElementById('realtime-price');
                if (priceElement) {
                    priceElement.textContent = this.formatPrice(markPrice);
                    
                    // Flash animation
                    priceElement.classList.add('price-flash');
                    setTimeout(() => priceElement.classList.remove('price-flash'), 300);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };
        
        this.priceWs.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    formatPrice(price) {
        return price.toFixed(this.precision);
    }

    formatVolume(volume) {
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toFixed(2);
    }

    formatNumber(num) {
        return num.toLocaleString();
    }

    // Technical Indicators
    calculateEMA(candles, period) {
        const prices = candles.map(c => c.close);
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        ema.push(sum / period);
        
        for (let i = period; i < prices.length; i++) {
            const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
            ema.push(value);
        }
        
        return ema;
    }

    calculateRSI(candles, period) {
        const prices = candles.map(c => c.close);
        const rsi = [];
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            
            const rs = avgGain / avgLoss;
            const rsiValue = 100 - (100 / (1 + rs));
            rsi.push(rsiValue);
        }
        
        return rsi;
    }

    calculateVWAP(candles) {
        const vwap = [];
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;
        
        for (let i = 0; i < candles.length; i++) {
            const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
            cumulativeTPV += typicalPrice * candles[i].volume;
            cumulativeVolume += candles[i].volume;
            vwap.push(cumulativeTPV / cumulativeVolume);
        }
        
        return vwap;
    }

    close() {
        if (this.priceWs) this.priceWs.close();
        if (this.orderbookWs) this.orderbookWs.close();
        if (this.updateInterval) clearInterval(this.updateInterval);
        super.close();
    }
}

window.SignalAnalyzerDialog = SignalAnalyzerDialog;
