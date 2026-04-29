// Position Size Calculator Dialog
class PositionSizeCalculatorDialog extends DialogBase {
    constructor() {
        super({
            id: 'position-size-calculator',
            title: 'Position Size Calculator',
            width: '500px'
        });
    }

    create() {
        super.create();
        this.renderContent();
        return this;
    }

    renderContent() {
        const content = document.createElement('div');

        // Input Section
        const inputSection = document.createElement('div');
        inputSection.className = 'tv-dialog-section';
        
        const grid = document.createElement('div');
        grid.className = 'tv-grid cols-2';
        
        // Account Balance
        const balanceInput = this.createInput({
            id: 'account-balance',
            type: 'number',
            placeholder: '10000',
            step: '0.01',
            min: '0'
        });
        grid.appendChild(this.createFormGroup('Account Balance ($)', balanceInput));
        
        // Risk Percentage
        const riskInput = this.createInput({
            id: 'risk-percent',
            type: 'number',
            placeholder: '1',
            step: '0.1',
            min: '0',
            max: '100',
            value: '1'
        });
        grid.appendChild(this.createFormGroup('Risk (%)', riskInput));
        
        // Entry Price
        const entryInput = this.createInput({
            id: 'entry-price-ps',
            type: 'number',
            placeholder: '50000',
            step: '0.01',
            min: '0'
        });
        grid.appendChild(this.createFormGroup('Entry Price', entryInput));
        
        // Stop Loss Price
        const stopLossInput = this.createInput({
            id: 'stop-loss-price',
            type: 'number',
            placeholder: '49000',
            step: '0.01',
            min: '0'
        });
        grid.appendChild(this.createFormGroup('Stop Loss Price', stopLossInput));
        
        // Leverage
        const leverageSelect = this.createSelect({
            id: 'leverage-ps',
            options: [
                { value: '1', label: '1x', selected: true },
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
                { value: '5', label: '5x' },
                { value: '10', label: '10x' },
                { value: '20', label: '20x' },
                { value: '25', label: '25x' }
            ]
        });
        grid.appendChild(this.createFormGroup('Leverage', leverageSelect));
        
        inputSection.appendChild(grid);

        // Calculate Button
        const calculateBtn = this.createButton('Calculate Position Size', {
            variant: 'primary',
            onClick: () => this.calculate()
        });
        calculateBtn.style.width = '100%';
        calculateBtn.style.marginTop = '16px';
        inputSection.appendChild(calculateBtn);

        // Results Section
        const resultsSection = document.createElement('div');
        resultsSection.className = 'tv-dialog-section';
        resultsSection.id = 'ps-results';
        resultsSection.style.display = 'none';
        
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'tv-section-title';
        sectionTitle.textContent = 'Recommended Position';
        resultsSection.appendChild(sectionTitle);
        
        resultsSection.appendChild(document.createElement('div')).id = 'ps-results-container';

        // Assemble
        content.appendChild(inputSection);
        content.appendChild(resultsSection);
        
        this.setContent(content);
    }

    calculate() {
        const balance = parseFloat(document.getElementById('account-balance').value);
        const riskPercent = parseFloat(document.getElementById('risk-percent').value);
        const entryPrice = parseFloat(document.getElementById('entry-price-ps').value);
        const stopLossPrice = parseFloat(document.getElementById('stop-loss-price').value);
        const leverage = parseFloat(document.getElementById('leverage-ps').value);

        // Validation
        if (!balance || !riskPercent || !entryPrice || !stopLossPrice) {
            alert('Please fill in all fields');
            return;
        }

        if (balance <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLossPrice <= 0) {
            alert('Values must be greater than 0');
            return;
        }

        if (entryPrice === stopLossPrice) {
            alert('Entry price and stop loss must be different');
            return;
        }

        // Calculate
        const riskAmount = balance * (riskPercent / 100);
        const priceRisk = Math.abs(entryPrice - stopLossPrice);
        const priceRiskPercent = (priceRisk / entryPrice) * 100;
        
        // Position size in base currency (e.g., BTC)
        const positionSize = riskAmount / priceRisk;
        
        // Position value in quote currency (e.g., USDT)
        const positionValue = positionSize * entryPrice;
        
        // Margin required
        const marginRequired = positionValue / leverage;
        
        // Check if margin exceeds balance
        if (marginRequired > balance) {
            alert('Margin required exceeds account balance. Reduce leverage or risk percentage.');
            return;
        }

        // Display results
        this.displayResults({
            balance,
            riskPercent,
            riskAmount,
            entryPrice,
            stopLossPrice,
            priceRisk,
            priceRiskPercent,
            positionSize,
            positionValue,
            marginRequired,
            leverage
        });
    }

    displayResults(data) {
        const resultsSection = document.getElementById('ps-results');
        const container = resultsSection.querySelector('#ps-results-container');
        
        container.innerHTML = '';

        // Risk Info
        container.appendChild(this.createResultDisplay(
            'Risk Amount',
            `$${data.riskAmount.toFixed(2)}`
        ));
        
        container.appendChild(this.createResultDisplay(
            'Price Risk',
            `$${data.priceRisk.toFixed(2)} (${data.priceRiskPercent.toFixed(2)}%)`
        ));

        // Divider
        const divider1 = document.createElement('div');
        divider1.className = 'tv-divider';
        container.appendChild(divider1);

        // Position Info
        const positionSizeDisplay = this.createResultDisplay(
            'Position Size',
            `${data.positionSize.toFixed(6)} units`,
            { highlight: true }
        );
        container.appendChild(positionSizeDisplay);

        container.appendChild(this.createResultDisplay(
            'Position Value',
            `$${data.positionValue.toFixed(2)}`
        ));

        container.appendChild(this.createResultDisplay(
            'Margin Required',
            `$${data.marginRequired.toFixed(2)}`
        ));

        // Divider
        const divider2 = document.createElement('div');
        divider2.className = 'tv-divider';
        container.appendChild(divider2);

        // Summary
        container.appendChild(this.createResultDisplay(
            'Leverage',
            `${data.leverage}x`
        ));

        container.appendChild(this.createResultDisplay(
            'Margin Usage',
            `${((data.marginRequired / data.balance) * 100).toFixed(2)}%`
        ));

        // Info box
        const infoBox = document.createElement('div');
        infoBox.className = 'tv-info-box';
        infoBox.innerHTML = `
            <div class="tv-info-text">
                <strong>Risk Management:</strong><br>
                Risking ${data.riskPercent}% ($${data.riskAmount.toFixed(2)}) of your $${data.balance.toFixed(2)} account.<br>
                Entry: $${data.entryPrice.toFixed(2)} | Stop Loss: $${data.stopLossPrice.toFixed(2)}<br>
                Position: ${data.positionSize.toFixed(6)} units with ${data.leverage}x leverage.
            </div>
        `;
        container.appendChild(infoBox);

        resultsSection.style.display = 'block';
    }
}

// Register
window.PositionSizeCalculatorDialog = PositionSizeCalculatorDialog;
