// Tool Manager - Manages all custom tools and sidebar
class ToolManager {
    constructor() {
        this.tools = [];
        this.sidebar = null;
        this.overlay = null;
        this.button = null;
    }

    // Register a tool
    registerTool(tool) {
        this.tools.push(tool);
    }

    // Initialize tool system
    init() {
        // Wait for tvWidget
        if (typeof tvWidget === 'undefined' || !tvWidget) {
            setTimeout(() => this.init(), 100);
            return;
        }

        tvWidget.onChartReady(() => {
            // Wait for header to be ready before creating button
            tvWidget.headerReady().then(() => {
                this.createToolButton();
                this.createToolSidebar();
                this.setupEventHandlers();
            });
        });
    }

    // Create tool button in header
    createToolButton() {
        this.button = tvWidget.createButton({ align: 'left' });
        this.button.setAttribute('title', 'Tools');
        this.button.innerHTML = `
            <div class="tv-tool-button-content">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2" fill="none"/>
                    <circle cx="10" cy="10" r="2" fill="currentColor"/>
                </svg>
            </div>
        `;
        this.button.classList.add('tv-tool-button');

        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSidebar();
        });
    }

    // Create tool sidebar
    createToolSidebar() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'tool-sidebar-overlay';
        this.overlay.id = 'tool-sidebar-overlay';

        // Create sidebar
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'tool-sidebar';
        this.sidebar.id = 'tool-sidebar';

        // Create header
        const header = document.createElement('div');
        header.className = 'tool-sidebar-header';
        header.innerHTML = `
            <h3 class="tool-sidebar-title">Tools</h3>
            <button class="tool-sidebar-close" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
            </button>
        `;

        // Create content
        const content = document.createElement('div');
        content.className = 'tool-sidebar-content';

        // Add tools
        this.tools.forEach(tool => {
            const item = this.createToolItem(tool);
            content.appendChild(item);
        });

        // Assemble
        this.sidebar.appendChild(header);
        this.sidebar.appendChild(content);

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.sidebar);
    }

    // Create tool item
    createToolItem(tool) {
        const item = document.createElement('div');
        item.className = 'tool-item';
        item.innerHTML = `
            <div class="tool-icon">${tool.icon}</div>
            <div class="tool-info">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-description">${tool.description}</div>
            </div>
            <svg class="tool-arrow" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
        `;

        item.addEventListener('click', () => {
            this.closeSidebar();
            tool.action();
        });

        return item;
    }

    // Setup event handlers
    setupEventHandlers() {
        // Close button
        const closeBtn = this.sidebar.querySelector('.tool-sidebar-close');
        closeBtn.addEventListener('click', () => this.closeSidebar());

        // Overlay click
        this.overlay.addEventListener('click', () => this.closeSidebar());

        // Prevent sidebar click from closing
        this.sidebar.addEventListener('click', (e) => e.stopPropagation());

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.sidebar.contains(e.target) && !e.target.closest('.tv-tool-button')) {
                this.closeSidebar();
            }
        });
    }

    // Toggle sidebar
    toggleSidebar() {
        if (this.sidebar.classList.contains('active')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    // Open sidebar
    openSidebar() {
        this.sidebar.classList.add('active');
        this.overlay.classList.add('active');
    }

    // Close sidebar
    closeSidebar() {
        this.sidebar.classList.remove('active');
        this.overlay.classList.remove('active');
    }
}

// Initialize tool manager
const toolManager = new ToolManager();

// Register PNL Calculator
toolManager.registerTool({
    name: 'PNL Calculator',
    description: 'Calculate profit and loss for futures positions',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    action: () => {
        const dialog = new PNLCalculatorDialog();
        dialog.show();
    }
});

// Register Position Size Calculator
toolManager.registerTool({
    name: 'Position Size Calculator',
    description: 'Calculate optimal position size based on risk',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>`,
    action: () => {
        const dialog = new PositionSizeCalculatorDialog();
        dialog.show();
    }
});

// Register Market Screener
toolManager.registerTool({
    name: 'Market Screener',
    description: 'View all Binance Futures symbols with live data',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    action: () => {
        const dialog = new ScreenerDialog();
        dialog.show();
    }
});

// Register Trading Calendar
toolManager.registerTool({
    name: 'Trading Calendar',
    description: 'Track your trades with calendar view and statistics',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2"/>
        <circle cx="8" cy="14" r="1" fill="currentColor"/>
        <circle cx="12" cy="14" r="1" fill="currentColor"/>
        <circle cx="16" cy="14" r="1" fill="currentColor"/>
        <circle cx="8" cy="18" r="1" fill="currentColor"/>
        <circle cx="12" cy="18" r="1" fill="currentColor"/>
    </svg>`,
    action: () => {
        const dialog = new CalendarProfitDialog();
        dialog.show();
    }
});

// Register Signal Analyzer
toolManager.registerTool({
    name: 'Signal Analyzer',
    description: 'Analyze trading signals using EMA, RSI, VWAP indicators',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>`,
    action: () => {
        const dialog = new SignalAnalyzerDialog();
        dialog.show();
    }
});

// Register Symbol List
toolManager.registerTool({
    name: 'Symbol List',
    description: 'View and switch between loaded symbols',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="7" cy="6" r="1.5" fill="currentColor"/>
        <circle cx="7" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="7" cy="18" r="1.5" fill="currentColor"/>
    </svg>`,
    action: () => {
        const dialog = new SymbolListDialog();
        dialog.show();
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => toolManager.init());
} else {
    toolManager.init();
}

// Export
window.ToolManager = ToolManager;
window.toolManager = toolManager;
