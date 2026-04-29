/**
 * Replay Engine V2
 * Quản lý chế độ replay bar - phát lại dữ liệu lịch sử từng bar một
 * Sử dụng kỹ thuật tạo chart mới trong container riêng
 */
class ReplayEngine {
    constructor() {
        // Replay state
        this.isActive = false;
        this.isPaused = true; // Start paused by default

        // Data
        this.allBars = [];           // Tất cả bars đã fetch
        this.visibleBarsCount = 0;   // Số bars đang hiển thị
        this.replayStartIndex = 0;   // Index bắt đầu replay

        // Speed control (ms per bar)
        this.speeds = [
            { label: '0.5x', interval: 2000 },
            { label: '1x', interval: 1000 },
            { label: '2x', interval: 500 },
            { label: '3x', interval: 333 },
            { label: '5x', interval: 200 },
            { label: '10x', interval: 100 },
        ];
        this.currentSpeedIndex = 1; // Default 1x

        // Timer
        this.replayTimer = null;

        // TradingView widget references
        this.mainWidget = null;      // Main realtime widget
        this.replayWidget = null;    // Replay widget
        this.originalDatafeed = null;

        // Callbacks
        this.onStateChange = null;
        this.onProgressUpdate = null;

        // Current symbol info for replay
        this.currentSymbol = null;
        this.currentResolution = null;

        // Keyboard shortcuts
        this._setupKeyboardShortcuts();
    }

    /**
     * Initialize với TradingView widget
     */
    init(tvWidget, originalDatafeed) {
        this.mainWidget = tvWidget;
        this.originalDatafeed = originalDatafeed;

        console.log('[ReplayEngine] Initialized');
    }

    /**
     * Bắt đầu chế độ replay
     * @param {number} startFromPercent - % từ cuối để bắt đầu replay (0 = từ đầu, 100 = từ cuối)
     */
    async startReplay(startFromPercent = 50) {
        if (this.isActive) {
            console.log('[ReplayEngine] Already in replay mode');
            return;
        }

        try {
            // Get current symbol and resolution from main chart
            this.currentSymbol = this.mainWidget.activeChart().symbol();
            this.currentResolution = this.mainWidget.activeChart().resolution();

            console.log(`[ReplayEngine] Starting replay for ${this.currentSymbol} @ ${this.currentResolution}`);

            // Show loading
            this._showLoadingOverlay();

            // Fetch historical data
            await this._fetchHistoricalData(this.currentSymbol, this.currentResolution);

            if (this.allBars.length < 10) {
                throw new Error('Not enough historical data for replay');
            }

            // Calculate start index
            const startIndex = Math.floor(this.allBars.length * (startFromPercent / 100));
            this.replayStartIndex = Math.max(50, startIndex); // Minimum 50 bars visible at start
            this.visibleBarsCount = this.replayStartIndex;

            // Set active state
            this.isActive = true;
            this.isPaused = true; // Start paused

            // Create replay widget
            await this._createReplayWidget();

            // Hide loading
            this._hideLoadingOverlay();

            // Notify state change
            this._notifyStateChange();

            console.log(`[ReplayEngine] Replay started from index ${this.replayStartIndex}/${this.allBars.length}`);

        } catch (error) {
            console.error('[ReplayEngine] Failed to start replay:', error);
            this._hideLoadingOverlay();
            this.stopReplay();
            throw error;
        }
    }

    /**
     * Dừng chế độ replay và quay lại realtime
     */
    async stopReplay() {
        if (!this.isActive) return;

        console.log('[ReplayEngine] Stopping replay');

        // Stop timer
        this._stopReplayTimer();

        // Destroy replay widget and show main widget
        this._destroyReplayWidget();

        // Reset state
        this.isActive = false;
        this.isPaused = true;
        this.allBars = [];
        this.visibleBarsCount = 0;

        // Notify state change
        this._notifyStateChange();
    }

    /**
     * Pause/Resume replay
     */
    togglePause() {
        if (!this.isActive) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this._stopReplayTimer();
        } else {
            this._startReplayTimer();
        }

        this._notifyStateChange();
    }

    /**
     * Play replay
     */
    play() {
        if (!this.isActive) return;
        if (!this.isPaused) return;

        this.isPaused = false;
        this._startReplayTimer();
        this._notifyStateChange();
    }

    /**
     * Pause replay
     */
    pause() {
        if (!this.isActive) return;
        if (this.isPaused) return;

        this.isPaused = true;
        this._stopReplayTimer();
        this._notifyStateChange();
    }

    /**
     * Tua đến bar tiếp theo (khi đang pause)
     */
    stepForward() {
        if (!this.isActive) return;
        if (!this.isPaused) this.pause();

        this._addNextBar();
    }

    /**
     * Tua lùi 1 bar (khi đang pause)
     */
    stepBackward() {
        if (!this.isActive) return;
        if (!this.isPaused) this.pause();
        if (this.visibleBarsCount <= 50) return; // Keep minimum bars

        this.visibleBarsCount--;
        this._updateReplayChart();
        this._notifyProgress();
    }

    /**
     * Thay đổi tốc độ replay
     * @param {number} speedIndex - Index trong mảng speeds
     */
    setSpeed(speedIndex) {
        if (speedIndex < 0 || speedIndex >= this.speeds.length) return;

        this.currentSpeedIndex = speedIndex;

        // Restart timer with new speed if playing
        if (this.isActive && !this.isPaused) {
            this._stopReplayTimer();
            this._startReplayTimer();
        }

        this._notifyStateChange();
    }

    /**
     * Increase speed
     */
    speedUp() {
        if (this.currentSpeedIndex < this.speeds.length - 1) {
            this.setSpeed(this.currentSpeedIndex + 1);
        }
    }

    /**
     * Decrease speed
     */
    speedDown() {
        if (this.currentSpeedIndex > 0) {
            this.setSpeed(this.currentSpeedIndex - 1);
        }
    }

    /**
     * Jump to specific position
     * @param {number} percent - Position in % (0-100)
     */
    jumpToPosition(percent) {
        if (!this.isActive) return;

        const newIndex = Math.floor(this.allBars.length * (percent / 100));
        this.visibleBarsCount = Math.max(50, Math.min(newIndex, this.allBars.length));

        this._updateReplayChart();
        this._notifyProgress();
    }

    /**
     * Get current state
     */
    getState() {
        return {
            isActive: this.isActive,
            isPaused: this.isPaused,
            currentSpeed: this.speeds[this.currentSpeedIndex],
            speedIndex: this.currentSpeedIndex,
            speeds: this.speeds,
            progress: this.allBars.length > 0 ? {
                current: this.visibleBarsCount,
                total: this.allBars.length,
                percent: Math.round((this.visibleBarsCount / this.allBars.length) * 100)
            } : null,
            currentBar: this.visibleBarsCount > 0 ? this.allBars[this.visibleBarsCount - 1] : null
        };
    }

    // ============ PRIVATE METHODS ============

    /**
     * Fetch historical data from original datafeed
     */
    async _fetchHistoricalData(symbol, resolution) {
        return new Promise((resolve, reject) => {
            // Calculate time range (last 2000 bars approx)
            const now = Math.floor(Date.now() / 1000);
            const resolutionSeconds = this._resolutionToSeconds(resolution);
            const from = now - (resolutionSeconds * 2000);

            // Create symbolInfo
            const symbolInfo = {
                name: symbol,
                full_name: symbol,
                ticker: symbol
            };

            // Fetch bars
            this.originalDatafeed.getBars(
                symbolInfo,
                resolution,
                { from, to: now, firstDataRequest: true },
                (bars, meta) => {
                    this.allBars = bars.sort((a, b) => a.time - b.time);
                    console.log(`[ReplayEngine] Fetched ${this.allBars.length} bars`);
                    resolve();
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    /**
     * Convert resolution to seconds
     */
    _resolutionToSeconds(resolution) {
        const map = {
            '1': 60,
            '5': 300,
            '15': 900,
            '30': 1800,
            '60': 3600,
            '240': 14400,
            '1D': 86400,
            '1W': 604800,
            '1M': 2592000
        };
        return map[resolution] || 900;
    }

    /**
     * Create replay datafeed
     */
    _createReplayDatafeed() {
        const self = this;

        return {
            onReady: (callback) => {
                setTimeout(() => callback({
                    supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                    exchanges: [],
                    symbols_types: [],
                    supports_marks: false,
                    supports_timescale_marks: false,
                    supports_time: true
                }), 0);
            },

            searchSymbols: (input, exchange, type, callback) => {
                callback([]);
            },

            resolveSymbol: (symbolName, onResolve, onError) => {
                // Simple symbol info for replay
                setTimeout(() => {
                    onResolve({
                        name: symbolName,
                        description: `${symbolName} (Replay)`,
                        type: 'crypto',
                        session: '24x7',
                        timezone: 'Etc/UTC',
                        ticker: symbolName,
                        minmov: 1,
                        pricescale: 100,
                        has_intraday: true,
                        has_daily: true,
                        supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
                        volume_precision: 2,
                        data_status: 'streaming'
                    });
                }, 0);
            },

            getBars: (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
                // Return only visible bars
                const visibleBars = self.allBars.slice(0, self.visibleBarsCount);

                if (visibleBars.length === 0) {
                    onHistoryCallback([], { noData: true });
                    return;
                }

                onHistoryCallback(visibleBars, { noData: false });
            },

            subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID) => {
                // Store callback for replay updates
                self._realtimeCallback = onRealtimeCallback;
            },

            unsubscribeBars: (subscriberUID) => {
                self._realtimeCallback = null;
            }
        };
    }

    /**
     * Create replay widget in overlay container
     */
    async _createReplayWidget() {
        return new Promise((resolve) => {
            // Hide main widget
            const mainContainer = document.getElementById('tv_chart_container');
            if (mainContainer) {
                mainContainer.style.display = 'none';
            }

            // Create replay container
            let replayContainer = document.getElementById('replay_chart_container');
            if (!replayContainer) {
                replayContainer = document.createElement('div');
                replayContainer.id = 'replay_chart_container';
                replayContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 100;
                    background: #131722;
                `;
                document.body.appendChild(replayContainer);
            }
            replayContainer.style.display = 'block';

            // Create replay widget with custom datafeed
            const replayDatafeed = this._createReplayDatafeed();

            this.replayWidget = new TradingView.widget({
                symbol: this.currentSymbol,
                datafeed: replayDatafeed,
                interval: this.currentResolution,
                container: 'replay_chart_container',
                library_path: 'charting_library/',
                locale: 'vi',
                timezone: "Asia/Ho_Chi_Minh",
                fullscreen: false,
                autosize: true,
                theme: 'dark',
                overrides: {
                    "mainSeriesProperties.showCountdown": false,
                    "paneProperties.legendProperties.showSeriesTitle": true,
                    "paneProperties.legendProperties.showSeriesOHLC": true,
                },
                disabled_features: [
                    'header_symbol_search',
                    'header_compare',
                    'header_saveload',
                    'header_screenshot',
                    'header_settings',
                    'timeframes_toolbar',
                    'popup_hints',
                    'bottom_toolbar',
                    'control_bar',
                ],
                enabled_features: [
                    'header_widget',
                ],
                custom_indicators_getter: function (PineJS) {
                    return Promise.resolve([
                        ...(typeof createATRBot !== 'undefined' ? [createATRBot(PineJS)] : []),
                        ...(typeof createVSR !== 'undefined' ? [createVSR(PineJS)] : []),
                    ]);
                },
            });

            // Wait for chart ready
            this.replayWidget.onChartReady(() => {
                console.log('[ReplayEngine] Replay chart ready');

                // Add replay mode indicator
                this.replayWidget.headerReady().then(() => {
                    const badge = this.replayWidget.createButton({ align: 'left' });
                    badge.innerHTML = '<span style="color: #f59e0b; font-weight: bold;">⏵ REPLAY MODE</span>';
                });

                resolve();
            });
        });
    }

    /**
     * Destroy replay widget and restore main widget
     */
    _destroyReplayWidget() {
        if (this.replayWidget) {
            this.replayWidget.remove();
            this.replayWidget = null;
        }

        const replayContainer = document.getElementById('replay_chart_container');
        if (replayContainer) {
            replayContainer.style.display = 'none';
        }

        const mainContainer = document.getElementById('tv_chart_container');
        if (mainContainer) {
            mainContainer.style.display = 'block';
        }
    }

    /**
     * Update replay chart with new bar
     */
    _updateReplayChart() {
        if (!this.replayWidget) return;

        // Reset data to trigger re-fetch
        try {
            this.replayWidget.activeChart().resetData();
        } catch (e) {
            console.warn('[ReplayEngine] Could not reset chart data:', e);
        }
    }

    /**
     * Add next bar during replay
     */
    _addNextBar() {
        if (this.visibleBarsCount >= this.allBars.length) {
            // Reached end
            this.isPaused = true;
            this._stopReplayTimer();
            this._notifyStateChange();
            return;
        }

        this.visibleBarsCount++;

        // Get the new bar
        const newBar = this.allBars[this.visibleBarsCount - 1];

        // Push via realtime callback if available
        if (this._realtimeCallback && newBar) {
            this._realtimeCallback({
                time: newBar.time,
                open: newBar.open,
                high: newBar.high,
                low: newBar.low,
                close: newBar.close,
                volume: newBar.volume
            });
        }

        this._notifyProgress();
    }

    /**
     * Start replay timer
     */
    _startReplayTimer() {
        if (this.replayTimer) {
            clearInterval(this.replayTimer);
        }

        const interval = this.speeds[this.currentSpeedIndex].interval;

        this.replayTimer = setInterval(() => {
            this._addNextBar();
        }, interval);
    }

    /**
     * Stop replay timer
     */
    _stopReplayTimer() {
        if (this.replayTimer) {
            clearInterval(this.replayTimer);
            this.replayTimer = null;
        }
    }

    /**
     * Show loading overlay
     */
    _showLoadingOverlay() {
        let overlay = document.getElementById('replay-loading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'replay-loading';
            overlay.innerHTML = `
                <div class="replay-loading-content">
                    <div class="replay-spinner"></div>
                    <div class="replay-loading-text">Loading historical data...</div>
                </div>
            `;
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(19, 23, 34, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;
            document.body.appendChild(overlay);

            // Add spinner styles
            const style = document.createElement('style');
            style.id = 'replay-loading-styles';
            style.textContent = `
                .replay-loading-content {
                    text-align: center;
                }
                .replay-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(59, 130, 246, 0.2);
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: replay-spin 0.8s linear infinite;
                    margin: 0 auto 16px;
                }
                .replay-loading-text {
                    color: #9ca3af;
                    font-size: 14px;
                }
                @keyframes replay-spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        overlay.style.display = 'flex';
    }

    /**
     * Hide loading overlay
     */
    _hideLoadingOverlay() {
        const overlay = document.getElementById('replay-loading');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Notify state change
     */
    _notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('replayStateChange', {
            detail: this.getState()
        }));
    }

    /**
     * Notify progress update
     */
    _notifyProgress() {
        if (this.onProgressUpdate) {
            this.onProgressUpdate(this.getState().progress);
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('replayProgress', {
            detail: this.getState()
        }));
    }

    /**
     * Setup keyboard shortcuts
     */
    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;

            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePause();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.stepForward();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.stepBackward();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.speedUp();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.speedDown();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.stopReplay();
                    break;
            }
        });
    }
}

// Global instance
window.replayEngine = new ReplayEngine();
