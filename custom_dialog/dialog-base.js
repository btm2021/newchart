// Base Dialog System for TradingView
// Provides a standard API for creating themed dialogs

class DialogBase {
    constructor(options = {}) {
        this.id = options.id || `dialog-${Date.now()}`;
        this.title = options.title || 'Dialog';
        this.width = options.width || '600px';
        this.height = options.height || 'auto';
        this.maxHeight = options.maxHeight || '90vh';
        this.onClose = options.onClose || null;
        
        this.dialog = null;
        this.overlay = null;
        this.contentContainer = null;
    }

    // Create dialog structure
    create() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'tv-dialog-overlay';
        this.overlay.id = `${this.id}-overlay`;

        // Create dialog
        this.dialog = document.createElement('div');
        this.dialog.className = 'tv-dialog';
        this.dialog.id = this.id;
        this.dialog.style.width = this.width;
        this.dialog.style.height = this.height;
        this.dialog.style.maxHeight = this.maxHeight;

        // Create header
        const header = document.createElement('div');
        header.className = 'tv-dialog-header';
        header.innerHTML = `
            <h3 class="tv-dialog-title">${this.title}</h3>
            <button class="tv-dialog-close" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
            </button>
        `;

        // Create content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'tv-dialog-content';

        // Assemble dialog
        this.dialog.appendChild(header);
        this.dialog.appendChild(this.contentContainer);

        // Add to DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.dialog);

        // Setup event listeners
        this.setupEventListeners();

        return this;
    }

    // Setup event listeners
    setupEventListeners() {
        // Close button - use event delegation to ensure it works
        const closeBtn = this.dialog.querySelector('.tv-dialog-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            });
        }

        // Overlay click
        this.overlay.addEventListener('click', (e) => {
            e.preventDefault();
            this.close();
        });

        // Prevent dialog click from closing
        this.dialog.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // ESC key
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this.escHandler);
    }

    // Set content (to be overridden by subclasses)
    setContent(content) {
        if (typeof content === 'string') {
            this.contentContainer.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.contentContainer.innerHTML = '';
            this.contentContainer.appendChild(content);
        }
        return this;
    }

    // Show dialog
    show() {
        if (!this.dialog) this.create();
        
        setTimeout(() => {
            this.overlay.classList.add('active');
            this.dialog.classList.add('active');
        }, 10);

        return this;
    }

    // Close dialog
    close() {
        this.overlay.classList.remove('active');
        this.dialog.classList.remove('active');

        setTimeout(() => {
            if (this.dialog) this.dialog.remove();
            if (this.overlay) this.overlay.remove();
            document.removeEventListener('keydown', this.escHandler);
            
            if (this.onClose) this.onClose();
        }, 300);
    }

    // Utility: Create form group
    createFormGroup(label, input) {
        const group = document.createElement('div');
        group.className = 'tv-form-group';
        
        const labelEl = document.createElement('label');
        labelEl.className = 'tv-form-label';
        labelEl.textContent = label;
        
        group.appendChild(labelEl);
        group.appendChild(input);
        
        return group;
    }

    // Utility: Create input
    createInput(options = {}) {
        const input = document.createElement('input');
        input.className = 'tv-form-input';
        input.type = options.type || 'text';
        input.placeholder = options.placeholder || '';
        input.value = options.value || '';
        
        if (options.id) input.id = options.id;
        if (options.step) input.step = options.step;
        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        
        return input;
    }

    // Utility: Create select
    createSelect(options = {}) {
        const select = document.createElement('select');
        select.className = 'tv-form-select';
        
        if (options.id) select.id = options.id;
        
        if (options.options) {
            options.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.selected) option.selected = true;
                select.appendChild(option);
            });
        }
        
        return select;
    }

    // Utility: Create button
    createButton(text, options = {}) {
        const button = document.createElement('button');
        button.className = `tv-button ${options.variant || 'primary'}`;
        button.textContent = text;
        
        if (options.onClick) {
            button.addEventListener('click', options.onClick);
        }
        
        return button;
    }

    // Utility: Create result display
    createResultDisplay(label, value, options = {}) {
        const display = document.createElement('div');
        display.className = `tv-result-display ${options.highlight ? 'highlight' : ''}`;
        
        const labelEl = document.createElement('div');
        labelEl.className = 'tv-result-label';
        labelEl.textContent = label;
        
        const valueEl = document.createElement('div');
        valueEl.className = 'tv-result-value';
        valueEl.textContent = value;
        
        display.appendChild(labelEl);
        display.appendChild(valueEl);
        
        return display;
    }
}

// Export for use in other files
window.DialogBase = DialogBase;
