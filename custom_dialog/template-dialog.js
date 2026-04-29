// Template Dialog - Copy this file to create new tools
// Replace "Template" with your tool name

class TemplateDialog extends DialogBase {
    constructor() {
        super({
            id: 'template-dialog',
            title: 'Template Tool',
            width: '500px',
            height: 'auto',
            maxHeight: '90vh'
        });
    }

    create() {
        super.create();
        this.renderContent();
        return this;
    }

    renderContent() {
        const content = document.createElement('div');

        // Section 1: Input Section
        const inputSection = document.createElement('div');
        inputSection.className = 'tv-dialog-section';
        
        // Example: Single column layout
        const input1 = this.createInput({
            id: 'input-1',
            type: 'text',
            placeholder: 'Enter value'
        });
        inputSection.appendChild(this.createFormGroup('Label 1', input1));

        // Example: Two column grid
        const grid = document.createElement('div');
        grid.className = 'tv-grid cols-2';
        
        const input2 = this.createInput({
            id: 'input-2',
            type: 'number',
            placeholder: '0',
            step: '0.01'
        });
        grid.appendChild(this.createFormGroup('Label 2', input2));
        
        const select1 = this.createSelect({
            id: 'select-1',
            options: [
                { value: 'opt1', label: 'Option 1', selected: true },
                { value: 'opt2', label: 'Option 2' }
            ]
        });
        grid.appendChild(this.createFormGroup('Label 3', select1));
        
        inputSection.appendChild(grid);

        // Example: Button group
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'tv-button-group';
        
        const btn1 = this.createButton('Action 1', {
            variant: 'secondary',
            onClick: () => this.handleAction1()
        });
        
        const btn2 = this.createButton('Action 2', {
            variant: 'primary',
            onClick: () => this.handleAction2()
        });
        
        buttonGroup.appendChild(btn1);
        buttonGroup.appendChild(btn2);
        inputSection.appendChild(buttonGroup);

        // Section 2: Results Section (initially hidden)
        const resultsSection = document.createElement('div');
        resultsSection.className = 'tv-dialog-section';
        resultsSection.id = 'template-results';
        resultsSection.style.display = 'none';
        
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'tv-section-title';
        sectionTitle.textContent = 'Results';
        resultsSection.appendChild(sectionTitle);
        
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'template-results-container';
        resultsSection.appendChild(resultsContainer);

        // Assemble all sections
        content.appendChild(inputSection);
        content.appendChild(resultsSection);
        
        this.setContent(content);
    }

    handleAction1() {
        // Handle action 1
        console.log('Action 1 clicked');
    }

    handleAction2() {
        // Get input values
        const value1 = document.getElementById('input-1').value;
        const value2 = parseFloat(document.getElementById('input-2').value);
        const value3 = document.getElementById('select-1').value;

        // Validation
        if (!value1 || !value2) {
            alert('Please fill in all required fields');
            return;
        }

        // Process data
        const result = this.processData(value1, value2, value3);

        // Display results
        this.displayResults(result);
    }

    processData(val1, val2, val3) {
        // Your calculation/processing logic here
        return {
            result1: val1.toUpperCase(),
            result2: val2 * 2,
            result3: val3
        };
    }

    displayResults(data) {
        const resultsSection = document.getElementById('template-results');
        const container = document.getElementById('template-results-container');
        
        // Clear previous results
        container.innerHTML = '';

        // Example: Simple result displays
        container.appendChild(this.createResultDisplay(
            'Result 1',
            data.result1
        ));

        container.appendChild(this.createResultDisplay(
            'Result 2',
            data.result2.toFixed(2),
            { highlight: true }
        ));

        // Example: Divider
        const divider = document.createElement('div');
        divider.className = 'tv-divider';
        container.appendChild(divider);

        // Example: Info box
        const infoBox = document.createElement('div');
        infoBox.className = 'tv-info-box success';
        infoBox.innerHTML = `
            <div class="tv-info-text">
                <strong>Summary:</strong><br>
                Your results have been calculated successfully.
            </div>
        `;
        container.appendChild(infoBox);

        // Show results section
        resultsSection.style.display = 'block';
    }
}

// Export (uncomment when ready to use)
// window.TemplateDialog = TemplateDialog;

// Register tool (add to tool-manager.js)
/*
toolManager.registerTool({
    name: 'Template Tool',
    description: 'Description of your tool',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    action: () => {
        const dialog = new TemplateDialog();
        dialog.show();
    }
});
*/
