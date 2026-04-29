let tvWidget = null;

async function initDatafeedManager() {
    const manager = new DatafeedManager();
    manager.registerDatasource(new OANDADatasource(), true);
    manager.registerDatasource(new BinanceFuturesDatasource());
    await manager.initialize();
    return manager;
}

async function initTradingView() {
    const datafeedManager = await initDatafeedManager();
    const saveLoadAdapter = new SaveLoadAdapter();

    const isMobile = window.matchMedia('(max-width: 1024px)').matches;

    // Debug: Hiển thị trạng thái lên loading screen để biết code có chạy đúng không
    if (isMobile) {
        setTimeout(() => {
            const msg = document.getElementById('loading-message');
            if (msg) msg.textContent = 'Chế độ Mobile: Đang ẩn thanh công cụ...';
        }, 100);
    }

    const disabledFeatures = [
        'timeframes_toolbar',
        'show_object_tree',
        'popup_hints',
        'bottom_toolbar',
        'control_bar',
        'open_account_manager',
        'trading_account_manager',
        'trading_notifications'
    ];

    if (isMobile) {
        disabledFeatures.push(
            //  'drawing_toolbar',
            //     'left_toolbar',
            //     'side_toolbar',
            //     //  'header_undo_redo',
            'header_screenshot',
            // 'header_compare',
            // 'header_saveload',
            //   'header_symbol_search',
            // 'header_settings'
        );
    }

    const widgetOptions = {
        symbol: 'BINNCE:IMXUSDT',
        datafeed: datafeedManager,
        interval: '15',
        container: 'tv_chart_container',
        library_path: 'charting_library/',
        locale: 'vi',
        timezone: "Asia/Ho_Chi_Minh",
        preset: isMobile ? 'mobile' : '',
        fullscreen: false,
        autosize: true,
        overrides: {
            "mainSeriesProperties.showCountdown": true
        },
        time_scale: {
            min_bar_spacing: 1,
        },
        disabled_features: disabledFeatures,
        enabled_features: [
            'countdown',
            'header_widget',
            'items_favoriting',
            'show_symbol_logos',
            'show_symbol_logo_in_legend',
            'show_exchange_logos',
            'study_templates',
            'header_symbol_search',
            'iframe_loading_compatibility_mode',
            'drawing_toolbar',
        ],
        theme: 'dark',
        load_last_chart: true,
        save_load_adapter: saveLoadAdapter.getAdapter(),
        auto_save_delay: 1,
        auto_save_chart_enabled: true,
        widgetbar: {
            details: false,
            watchlist: false,
            datawindow: false,
            news: false
        },
        favorites: {
            intervals: ['1', '15', '60', '240'],
            chartTypes: ['Candles', 'Line']
        },
        user_id: 'husky',
        client_id: 'husky.com',
        custom_indicators_getter: function (PineJS) {
            return Promise.resolve([
                createATRBot(PineJS),
                createATRBotVP(PineJS),
                createVSR(PineJS),
                createVSROriginal(PineJS),
                createSessionVP(PineJS),
                createSwingPoints(PineJS),
                createVIDYA(PineJS),
                createKAMA(PineJS),
                createSMC(PineJS),
                createFVG(PineJS)
            ]);
        },


    };

    window.tvWidget = new TradingView.widget(widgetOptions);
    tvWidget = window.tvWidget;

    // Initialize replay system when widget is ready
    tvWidget.onChartReady(() => {
        console.log('[TradingView] Chart ready, initializing replay system...');

        // Initialize replay engine
        if (window.replayEngine) {
            window.replayEngine.init(tvWidget, datafeedManager);
        }

        // Initialize replay UI
        if (window.replayUI && window.replayEngine) {
            window.replayUI.init(window.replayEngine);
        }

        // Add replay button to header using TradingView API
        try {
            tvWidget.headerReady().then(() => {
                const replayBtn = tvWidget.createButton({ align: 'right' });
                replayBtn.setAttribute('title', 'Bar Replay');
                replayBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        <line x1="21" y1="6" x2="21" y2="18" stroke-dasharray="2,2"></line>
                    </svg>
                `;
                replayBtn.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #787b86;
                    transition: color 0.2s;
                `;
                replayBtn.addEventListener('mouseover', () => replayBtn.style.color = '#2962ff');
                replayBtn.addEventListener('mouseout', () => replayBtn.style.color = '#787b86');
                replayBtn.addEventListener('click', () => {
                    window.embedWidget.toggleReplay();
                });

                console.log('[TradingView] Replay button added to header');
            });
        } catch (e) {
            console.warn('[TradingView] Could not add replay button:', e);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTradingView);
} else {
    initTradingView();
}

window.embedWidget = {
    setSymbol: function (symbol) {
        if (tvWidget) {
            tvWidget.activeChart().setSymbol(symbol);
        }
    },
    setInterval: function (interval) {
        if (tvWidget) {
            tvWidget.activeChart().setResolution(interval);
        }
    },
    openSymbolSearch: function () {
        if (tvWidget) {
            tvWidget.activeChart().executeActionById('symbolSearch');
        }
    },
    openIndicators: function () {
        if (tvWidget) {
            tvWidget.activeChart().executeActionById('insertIndicator');
        }
    },
    toggleReplay: function () {
        if (window.replayUI) {
            window.replayUI.toggle();
        }
    },
    startReplay: function (startPercent = 50) {
        if (window.replayEngine) {
            window.replayEngine.startReplay(startPercent);
        }
    },
    stopReplay: function () {
        if (window.replayEngine) {
            window.replayEngine.stopReplay();
        }
    }
};
