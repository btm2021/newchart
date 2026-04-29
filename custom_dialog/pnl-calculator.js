// PNL Calculator Dialog - Binance Style
class PNLCalculatorDialog extends DialogBase {
    constructor() {
        super({
            id: 'pnl-calculator',
            title: 'PNL Calculator',
            width: '500px'
        });
        
        this.mode = 'long'; // long or short
    }

    create() {
        super.create();
        this.renderContent();
        return this;
    }

    renderContent() {
        const content = document.createElement('div');

        // Mode Selector
        const modeSection = document.createElement('div');
        modeSection.className = 'tv-dialog-section';
        
        const modeButtons = document.createElement('div');
        modeButtons.className = 'tv-button-group';
        
        const longBtn = this.createButton('Long', {
            variant: this.mode === 'long' ? 'primary' : 'secondary',
            onClick: () => this.switchMode('long', longBtn, shortBtn)
        });
        
        const shortBtn = this.createButton('Short', {
            variant: this.mode === 'short' ? 'primary' : 'secondary',
            onClick: () => this.switchMode('short', longBtn, shortBtn)
        });
        
        modeButtons.appendChild(longBtn);
        modeButtons.appendChild(shortBtn);
        modeSection.appendChild(modeButtons);

        // Input Section
        const inputSection = document.createElement('div');
        inputSection.className = 'tv-dialog-section';
        
        const grid = document.createElement('div');
        grid.className = 'tv-grid cols-2';
        
        // Entry Price
        const entryInput = this.createInput({
            id: 'entry-price',
            type: 'number',
            placeholder: '0.00',
            step: '0.01',
            min: '0'
        });
        grid.appendChild(this.createFormGroup('Entry Price', entryInput));
        
        // Exit Price
        const exitInput = this.createInput({
            id: 'exit-price',
            type: 'number',
            placeholder: '0.00',
            step: '0.01',
            min: '0'
        });
        grid.appendChild(this.createFormGroup('Exit Price', exitInput));
        
        // Quantity
        const quantityInput = this.createInput({
            id: 'quantity',
            type: 'number',
            placeholder: '0.00',
            step: '0.001',
            min: '0'
        });
        grid.appendChild(this.createFormGroup('Quantity', quantityInput));
        
        // Leverage
        const leverageSelect = this.createSelect({
            id: 'leverage',
            options: [
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
                { value: '5', label: '5x' },
                { value: '10', label: '10x' },
                { value: '20', label: '20x' },
                { value: '25', label: '25x', selected: true },
                { value: '50', label: '50x' },
                { value: '75', label: '75x' },
                { value: '100', label: '100x' },
                { value: '125', label: '125x' }
            ]
        });
        grid.appendChild(this.createFormGroup('Leverage', leverageSelect));
        
        inputSection.appendChild(grid);

        // Calculate Button
        const calculateBtn = this.createButton('Calculate', {
            variant: 'primary',
            onClick: () => this.calculate()
        });
        calculateBtn.style.width = '100%';
        calculateBtn.style.marginTop = '16px';
        inputSection.appendChild(calculateBtn);

        // Results Section
        const resultsSection = document.createElement('div');
        resultsSection.className = 'tv-dialog-section';
        resultsSection.id = 'pnl-results';
        resultsSection.style.display = 'none';
        
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'tv-section-title';
        sectionTitle.textContent = 'Results';
        resultsSection.appendChild(sectionTitle);
        
        resultsSection.appendChild(document.createElement('div')).id = 'results-container';

        // Assemble
        content.appendChild(modeSection);
        content.appendChild(inputSection);
        content.appendChild(resultsSection);
        
        this.setContent(content);
    }

    switchMode(mode, longBtn, shortBtn) {
        this.mode = mode;
        
        if (mode === 'long') {
            longBtn.className = 'tv-button primary';
            shortBtn.className = 'tv-button secondary';
        } else {
            longBtn.className = 'tv-button secondary';
            shortBtn.className = 'tv-button primary';
        }
    }

    calculate() {
        const entryPrice = parseFloat(document.getElementById('entry-price').value);
        const exitPrice = parseFloat(document.getElementById('exit-price').value);
        const quantity = parseFloat(document.getElementById('quantity').value);
        const leverage = parseFloat(document.getElementById('leverage').value);

        // Validation
        if (!entryPrice || !exitPrice || !quantity || !leverage) {
            alert('Please fill in all fields');
            return;
        }

        if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) {
            alert('Values must be greater than 0');
            return;
        }

        // Calculate
        const positionSize = quantity * entryPrice;
        const margin = positionSize / leverage;
        
        let pnl, pnlPercent, roi;
        
        if (this.mode === 'long') {
            pnl = (exitPrice - entryPrice) * quantity;
            pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
        } else {
            pnl = (entryPrice - exitPrice) * quantity;
            pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
        }
        
        roi = (pnl / margin) * 100;

        // Display results
        this.displayResults({
            entryPrice,
            exitPrice,
            quantity,
            leverage,
            positionSize,
            margin,
            pnl,
            pnlPercent,
            roi
        });
    }

    displayResults(data) {
        const resultsSection = document.getElementById('pnl-results');
        const container = resultsSection.querySelector('#results-container');
        
        container.innerHTML = '';

        // Position Info
        container.appendChild(this.createResultDisplay(
            'Position Size',
            `$${data.positionSize.toFixed(2)}`
        ));
        
        container.appendChild(this.createResultDisplay(
            'Margin Required',
            `$${data.margin.toFixed(2)}`
        ));

        // Divider
        const divider = document.createElement('div');
        divider.className = 'tv-divider';
        container.appendChild(divider);

        // PNL
        const pnlDisplay = this.createResultDisplay(
            'PNL',
            `$${data.pnl.toFixed(2)}`,
            { highlight: true }
        );
        const pnlValue = pnlDisplay.querySelector('.tv-result-value');
        pnlValue.className = `tv-result-value ${data.pnl >= 0 ? 'positive' : 'negative'}`;
        container.appendChild(pnlDisplay);

        // PNL %
        const pnlPercentDisplay = this.createResultDisplay(
            'PNL %',
            `${data.pnlPercent >= 0 ? '+' : ''}${data.pnlPercent.toFixed(2)}%`
        );
        const pnlPercentValue = pnlPercentDisplay.querySelector('.tv-result-value');
        pnlPercentValue.className = `tv-result-value ${data.pnlPercent >= 0 ? 'positive' : 'negative'}`;
        container.appendChild(pnlPercentDisplay);

        // ROI
        const roiDisplay = this.createResultDisplay(
            'ROI',
            `${data.roi >= 0 ? '+' : ''}${data.roi.toFixed(2)}%`
        );
        const roiValue = roiDisplay.querySelector('.tv-result-value');
        roiValue.className = `tv-result-value ${data.roi >= 0 ? 'positive' : 'negative'}`;
        container.appendChild(roiDisplay);

        // Info box
        const infoBox = document.createElement('div');
        infoBox.className = `tv-info-box ${data.pnl >= 0 ? 'success' : 'error'}`;
        infoBox.innerHTML = `
            <div class="tv-info-text">
                ${this.mode === 'long' ? 'Long' : 'Short'} position with ${data.leverage}x leverage.
                ${data.pnl >= 0 ? 'Profit' : 'Loss'}: $${Math.abs(data.pnl).toFixed(2)}
            </div>
        `;
        container.appendChild(infoBox);

        resultsSection.style.display = 'block';
    }
}

// Register tool
window.PNLCalculatorDialog = PNLCalculatorDialog;
