/**
 * Replay UI
 * Giao diện điều khiển chế độ replay
 */
class ReplayUI {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.engine = null;

        // Elements
        this.elements = {};
    }

    /**
     * Initialize UI
     */
    init(replayEngine) {
        this.engine = replayEngine;

        // Create UI elements
        this._createUI();

        // Listen for state changes
        window.addEventListener('replayStateChange', (e) => {
            this._updateUI(e.detail);
        });

        window.addEventListener('replayProgress', (e) => {
            this._updateProgress(e.detail);
        });

        console.log('[ReplayUI] Initialized');
    }

    /**
     * Show/Hide replay control panel
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (this.container) {
            this.container.style.display = 'flex';
            this.isVisible = true;
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Create UI elements
     */
    _createUI() {
        // Remove existing if any
        const existing = document.getElementById('replay-controls');
        if (existing) existing.remove();

        // Create container
        this.container = document.createElement('div');
        this.container.id = 'replay-controls';
        this.container.className = 'replay-controls';
        this.container.innerHTML = `
            <div class="replay-panel">
                <!-- Header -->
                <div class="replay-header">
                    <div class="replay-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>Bar Replay</span>
                    </div>
                    <button class="replay-close-btn" id="replay-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <!-- Status -->
                <div class="replay-status" id="replay-status">
                    <span class="status-indicator idle"></span>
                    <span class="status-text">Ready to start</span>
                </div>
                
                <!-- Start Position Slider -->
                <div class="replay-section" id="start-section">
                    <label>Start Position</label>
                    <div class="slider-container">
                        <input type="range" id="start-position" min="10" max="90" value="50" />
                        <span id="start-position-value">50%</span>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="replay-section replay-progress-section" id="progress-section" style="display: none;">
                    <div class="progress-info">
                        <span id="progress-current">0</span>
                        <span>/</span>
                        <span id="progress-total">0</span>
                        <span class="progress-percent" id="progress-percent">0%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    <input type="range" class="progress-slider" id="progress-slider" min="5" max="100" value="50" />
                </div>
                
                <!-- Bar Info -->
                <div class="replay-section bar-info-section" id="bar-info-section" style="display: none;">
                    <div class="bar-time" id="bar-time">--</div>
                    <div class="bar-ohlc">
                        <div class="ohlc-item">
                            <span class="ohlc-label">O</span>
                            <span class="ohlc-value" id="bar-open">--</span>
                        </div>
                        <div class="ohlc-item">
                            <span class="ohlc-label">H</span>
                            <span class="ohlc-value" id="bar-high">--</span>
                        </div>
                        <div class="ohlc-item">
                            <span class="ohlc-label">L</span>
                            <span class="ohlc-value" id="bar-low">--</span>
                        </div>
                        <div class="ohlc-item">
                            <span class="ohlc-label">C</span>
                            <span class="ohlc-value" id="bar-close">--</span>
                        </div>
                    </div>
                </div>
                
                <!-- Speed Control -->
                <div class="replay-section speed-section" id="speed-section" style="display: none;">
                    <label>Speed</label>
                    <div class="speed-buttons" id="speed-buttons">
                        <button class="speed-btn" data-speed="0">0.5x</button>
                        <button class="speed-btn active" data-speed="1">1x</button>
                        <button class="speed-btn" data-speed="2">2x</button>
                        <button class="speed-btn" data-speed="3">3x</button>
                        <button class="speed-btn" data-speed="4">5x</button>
                        <button class="speed-btn" data-speed="5">10x</button>
                    </div>
                </div>
                
                <!-- Control Buttons -->
                <div class="replay-controls-buttons">
                    <!-- Before Start -->
                    <div class="controls-row" id="start-controls">
                        <button class="replay-btn primary" id="replay-start-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Start Replay
                        </button>
                    </div>
                    
                    <!-- During Replay -->
                    <div class="controls-row" id="playing-controls" style="display: none;">
                        <button class="replay-btn icon-btn" id="step-back-btn" title="Step Back (←)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                                <line x1="5" y1="19" x2="5" y2="5"></line>
                            </svg>
                        </button>
                        <button class="replay-btn primary play-pause-btn" id="play-pause-btn" title="Play/Pause (Space)">
                            <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            <svg class="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                <rect x="6" y="4" width="4" height="16"></rect>
                                <rect x="14" y="4" width="4" height="16"></rect>
                            </svg>
                        </button>
                        <button class="replay-btn icon-btn" id="step-forward-btn" title="Step Forward (→)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                                <line x1="19" y1="5" x2="19" y2="19"></line>
                            </svg>
                        </button>
                        <button class="replay-btn danger" id="stop-btn" title="Stop (Esc)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12"></rect>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Keyboard Hints -->
                <div class="keyboard-hints">
                    <span class="hint"><kbd>Space</kbd> Play/Pause</span>
                    <span class="hint"><kbd>←</kbd><kbd>→</kbd> Step</span>
                    <span class="hint"><kbd>↑</kbd><kbd>↓</kbd> Speed</span>
                    <span class="hint"><kbd>Esc</kbd> Stop</span>
                </div>
            </div>
        `;

        // Add styles
        this._addStyles();

        // Append to body
        document.body.appendChild(this.container);

        // Cache elements
        this.elements = {
            status: document.getElementById('replay-status'),
            startSection: document.getElementById('start-section'),
            progressSection: document.getElementById('progress-section'),
            barInfoSection: document.getElementById('bar-info-section'),
            speedSection: document.getElementById('speed-section'),
            startControls: document.getElementById('start-controls'),
            playingControls: document.getElementById('playing-controls'),

            startPosition: document.getElementById('start-position'),
            startPositionValue: document.getElementById('start-position-value'),

            progressCurrent: document.getElementById('progress-current'),
            progressTotal: document.getElementById('progress-total'),
            progressPercent: document.getElementById('progress-percent'),
            progressBar: document.getElementById('progress-bar'),
            progressSlider: document.getElementById('progress-slider'),

            barTime: document.getElementById('bar-time'),
            barOpen: document.getElementById('bar-open'),
            barHigh: document.getElementById('bar-high'),
            barLow: document.getElementById('bar-low'),
            barClose: document.getElementById('bar-close'),

            speedButtons: document.getElementById('speed-buttons'),

            playPauseBtn: document.getElementById('play-pause-btn'),
            playIcon: document.querySelector('.play-icon'),
            pauseIcon: document.querySelector('.pause-icon'),
        };

        // Bind events
        this._bindEvents();

        // Initially hidden
        this.container.style.display = 'none';
    }

    /**
     * Add CSS styles
     */
    _addStyles() {
        const styleId = 'replay-ui-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .replay-controls {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                display: flex;
                justify-content: center;
            }
            
            .replay-panel {
                background: linear-gradient(145deg, rgba(30, 35, 45, 0.98), rgba(20, 25, 35, 0.98));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 16px;
                min-width: 360px;
                max-width: 420px;
                box-shadow: 
                    0 20px 40px rgba(0, 0, 0, 0.4),
                    0 0 40px rgba(59, 130, 246, 0.1);
                backdrop-filter: blur(20px);
            }
            
            .replay-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            
            .replay-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: #fff;
            }
            
            .replay-title svg {
                color: #3b82f6;
            }
            
            .replay-close-btn {
                background: transparent;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                padding: 4px;
                border-radius: 6px;
                transition: all 0.2s;
            }
            
            .replay-close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            .replay-status {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                margin-bottom: 12px;
            }
            
            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            .status-indicator.idle {
                background: #6b7280;
                animation: none;
            }
            
            .status-indicator.playing {
                background: #22c55e;
            }
            
            .status-indicator.paused {
                background: #f59e0b;
                animation: none;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .status-text {
                font-size: 12px;
                color: #9ca3af;
            }
            
            .replay-section {
                margin-bottom: 12px;
            }
            
            .replay-section label {
                display: block;
                font-size: 11px;
                color: #6b7280;
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .slider-container {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .slider-container input[type="range"] {
                flex: 1;
                height: 4px;
                border-radius: 2px;
                background: rgba(255, 255, 255, 0.1);
                -webkit-appearance: none;
                cursor: pointer;
            }
            
            .slider-container input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .slider-container input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }
            
            .slider-container span {
                font-size: 12px;
                color: #9ca3af;
                min-width: 35px;
            }
            
            /* Progress Section */
            .replay-progress-section .progress-info {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #9ca3af;
                margin-bottom: 8px;
            }
            
            .progress-percent {
                margin-left: auto;
                color: #3b82f6;
                font-weight: 600;
            }
            
            .progress-bar-container {
                height: 4px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                border-radius: 2px;
                transition: width 0.3s ease;
                width: 0%;
            }
            
            .progress-slider {
                width: 100%;
                height: 4px;
                -webkit-appearance: none;
                background: transparent;
                cursor: pointer;
            }
            
            .progress-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #8b5cf6;
                cursor: pointer;
            }
            
            /* Bar Info */
            .bar-info-section {
                background: rgba(0, 0, 0, 0.2);
                padding: 10px 12px;
                border-radius: 8px;
            }
            
            .bar-time {
                font-size: 11px;
                color: #6b7280;
                margin-bottom: 8px;
            }
            
            .bar-ohlc {
                display: flex;
                gap: 16px;
            }
            
            .ohlc-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .ohlc-label {
                font-size: 10px;
                color: #6b7280;
            }
            
            .ohlc-value {
                font-size: 12px;
                color: #d1d5db;
                font-family: monospace;
            }
            
            /* Speed Buttons */
            .speed-buttons {
                display: flex;
                gap: 6px;
            }
            
            .speed-btn {
                flex: 1;
                padding: 6px 8px;
                font-size: 11px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: #9ca3af;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .speed-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            .speed-btn.active {
                background: linear-gradient(145deg, #3b82f6, #2563eb);
                border-color: #3b82f6;
                color: #fff;
            }
            
            /* Control Buttons */
            .replay-controls-buttons {
                margin-top: 14px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }
            
            .controls-row {
                display: flex;
                gap: 8px;
                justify-content: center;
            }
            
            .replay-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 10px 20px;
                font-size: 13px;
                font-weight: 500;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .replay-btn.primary {
                background: linear-gradient(145deg, #3b82f6, #2563eb);
                color: #fff;
                flex: 1;
            }
            
            .replay-btn.primary:hover {
                background: linear-gradient(145deg, #60a5fa, #3b82f6);
                transform: translateY(-1px);
            }
            
            .replay-btn.danger {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
                padding: 10px 14px;
            }
            
            .replay-btn.danger:hover {
                background: rgba(239, 68, 68, 0.3);
            }
            
            .replay-btn.icon-btn {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #9ca3af;
                padding: 10px 14px;
            }
            
            .replay-btn.icon-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            .play-pause-btn {
                min-width: 80px;
            }
            
            /* Keyboard Hints */
            .keyboard-hints {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                justify-content: center;
            }
            
            .hint {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 10px;
                color: #6b7280;
            }
            
            kbd {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 18px;
                padding: 2px 5px;
                font-size: 10px;
                font-family: inherit;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 4px;
                color: #9ca3af;
            }
            
            /* Mobile Responsive */
            @media (max-width: 480px) {
                .replay-panel {
                    min-width: 320px;
                    max-width: calc(100vw - 20px);
                    margin: 0 10px;
                }
                
                .keyboard-hints {
                    display: none;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Bind event handlers
     */
    _bindEvents() {
        // Close button
        document.getElementById('replay-close')?.addEventListener('click', () => {
            this.hide();
        });

        // Start position slider
        this.elements.startPosition?.addEventListener('input', (e) => {
            this.elements.startPositionValue.textContent = `${e.target.value}%`;
        });

        // Start button
        document.getElementById('replay-start-btn')?.addEventListener('click', async () => {
            const startPercent = parseInt(this.elements.startPosition.value);
            await this.engine.startReplay(startPercent);
        });

        // Play/Pause button
        document.getElementById('play-pause-btn')?.addEventListener('click', () => {
            this.engine.togglePause();
        });

        // Step buttons
        document.getElementById('step-back-btn')?.addEventListener('click', () => {
            this.engine.stepBackward();
        });

        document.getElementById('step-forward-btn')?.addEventListener('click', () => {
            this.engine.stepForward();
        });

        // Stop button
        document.getElementById('stop-btn')?.addEventListener('click', () => {
            this.engine.stopReplay();
        });

        // Speed buttons
        this.elements.speedButtons?.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseInt(btn.dataset.speed);
                this.engine.setSpeed(speed);
            });
        });

        // Progress slider
        this.elements.progressSlider?.addEventListener('input', (e) => {
            const percent = parseInt(e.target.value);
            this.engine.jumpToPosition(percent);
        });
    }

    /**
     * Update UI based on state
     */
    _updateUI(state) {
        const { isActive, isPaused, speedIndex } = state;

        // Update status
        const statusIndicator = this.elements.status.querySelector('.status-indicator');
        const statusText = this.elements.status.querySelector('.status-text');

        if (!isActive) {
            statusIndicator.className = 'status-indicator idle';
            statusText.textContent = 'Ready to start';
        } else if (isPaused) {
            statusIndicator.className = 'status-indicator paused';
            statusText.textContent = 'Paused';
        } else {
            statusIndicator.className = 'status-indicator playing';
            statusText.textContent = `Playing at ${state.currentSpeed.label}`;
        }

        // Toggle sections visibility
        this.elements.startSection.style.display = isActive ? 'none' : 'block';
        this.elements.progressSection.style.display = isActive ? 'block' : 'none';
        this.elements.barInfoSection.style.display = isActive ? 'block' : 'none';
        this.elements.speedSection.style.display = isActive ? 'block' : 'none';
        this.elements.startControls.style.display = isActive ? 'none' : 'flex';
        this.elements.playingControls.style.display = isActive ? 'flex' : 'none';

        // Update play/pause button
        if (this.elements.playIcon && this.elements.pauseIcon) {
            this.elements.playIcon.style.display = isPaused ? 'block' : 'none';
            this.elements.pauseIcon.style.display = isPaused ? 'none' : 'block';
        }

        // Update speed buttons
        this.elements.speedButtons?.querySelectorAll('.speed-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index === speedIndex);
        });

        // Update bar info
        if (state.currentBar) {
            this._updateBarInfo(state.currentBar);
        }
    }

    /**
     * Update progress display
     */
    _updateProgress(progress) {
        if (!progress) return;

        this.elements.progressCurrent.textContent = progress.current;
        this.elements.progressTotal.textContent = progress.total;
        this.elements.progressPercent.textContent = `${progress.percent}%`;
        this.elements.progressBar.style.width = `${progress.percent}%`;
        this.elements.progressSlider.value = progress.percent;
    }

    /**
     * Update bar info display
     */
    _updateBarInfo(bar) {
        const date = new Date(bar.time);
        this.elements.barTime.textContent = date.toLocaleString('vi-VN');
        this.elements.barOpen.textContent = bar.open.toFixed(4);
        this.elements.barHigh.textContent = bar.high.toFixed(4);
        this.elements.barLow.textContent = bar.low.toFixed(4);
        this.elements.barClose.textContent = bar.close.toFixed(4);
    }
}

// Global instance
window.replayUI = new ReplayUI();
