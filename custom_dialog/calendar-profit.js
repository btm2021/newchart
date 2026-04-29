// Calendar Profit Dialog - Trading Journal with Calendar View
class CalendarProfitDialog extends DialogBase {
    constructor() {
        super({
            id: 'calendar-profit',
            title: 'Trading Calendar',
            width: '90vw',
            maxHeight: '90vh'
        });
        
        this.currentDate = new Date();
        this.trades = this.loadTrades();
        this.selectedDate = null;
    }

    create() {
        super.create();
        this.renderContent();
        return this;
    }

    renderContent() {
        const content = document.createElement('div');
        content.className = 'calendar-container';

        // Header with month navigation and stats
        const header = this.createHeader();
        content.appendChild(header);

        // Main content: Calendar + Form
        const mainContent = document.createElement('div');
        mainContent.className = 'calendar-main';

        // Calendar view
        const calendarView = document.createElement('div');
        calendarView.className = 'calendar-view';
        calendarView.id = 'calendar-view';
        this.renderCalendar(calendarView);

        // Trade form
        const tradeForm = this.createTradeForm();

        mainContent.appendChild(calendarView);
        mainContent.appendChild(tradeForm);

        content.appendChild(mainContent);
        
        this.setContent(content);
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'calendar-header';

        // Month navigation
        const nav = document.createElement('div');
        nav.className = 'calendar-nav';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'tv-button secondary';
        prevBtn.innerHTML = '◀';
        prevBtn.onclick = () => this.changeMonth(-1);

        const monthYear = document.createElement('div');
        monthYear.className = 'calendar-month-year';
        monthYear.id = 'calendar-month-year';
        monthYear.textContent = this.getMonthYearText();

        const nextBtn = document.createElement('button');
        nextBtn.className = 'tv-button secondary';
        nextBtn.innerHTML = '▶';
        nextBtn.onclick = () => this.changeMonth(1);

        const todayBtn = document.createElement('button');
        todayBtn.className = 'tv-button secondary';
        todayBtn.textContent = 'Today';
        todayBtn.onclick = () => this.goToToday();

        nav.appendChild(prevBtn);
        nav.appendChild(monthYear);
        nav.appendChild(nextBtn);
        nav.appendChild(todayBtn);

        // Stats
        const stats = document.createElement('div');
        stats.className = 'calendar-stats';
        stats.id = 'calendar-stats';
        this.updateStats(stats);

        header.appendChild(nav);
        header.appendChild(stats);

        return header;
    }

    createTradeForm() {
        const form = document.createElement('div');
        form.className = 'trade-form';
        form.id = 'trade-form';

        const title = document.createElement('div');
        title.className = 'trade-form-title';
        title.textContent = 'Add Trade';

        const formContent = document.createElement('div');
        formContent.className = 'trade-form-content';

        // Date input
        const dateInput = this.createInput({
            id: 'trade-date',
            type: 'date',
            value: this.formatDateForInput(new Date())
        });
        formContent.appendChild(this.createFormGroup('Date', dateInput));

        // Symbol input
        const symbolInput = this.createInput({
            id: 'trade-symbol',
            type: 'text',
            placeholder: 'BTCUSDT'
        });
        formContent.appendChild(this.createFormGroup('Symbol', symbolInput));

        // Entry & Exit
        const grid = document.createElement('div');
        grid.className = 'tv-grid cols-2';

        const entryInput = this.createInput({
            id: 'trade-entry',
            type: 'number',
            placeholder: '50000',
            step: '0.01'
        });
        grid.appendChild(this.createFormGroup('Entry Price', entryInput));

        const exitInput = this.createInput({
            id: 'trade-exit',
            type: 'number',
            placeholder: '51000',
            step: '0.01'
        });
        grid.appendChild(this.createFormGroup('Exit Price', exitInput));

        formContent.appendChild(grid);

        // Leverage & PNL
        const grid2 = document.createElement('div');
        grid2.className = 'tv-grid cols-2';

        const leverageSelect = this.createSelect({
            id: 'trade-leverage',
            options: [
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '5', label: '5x' },
                { value: '10', label: '10x', selected: true },
                { value: '20', label: '20x' },
                { value: '25', label: '25x' }
            ]
        });
        grid2.appendChild(this.createFormGroup('Leverage', leverageSelect));

        const pnlInput = this.createInput({
            id: 'trade-pnl',
            type: 'number',
            placeholder: '100',
            step: '0.01'
        });
        grid2.appendChild(this.createFormGroup('PNL ($)', pnlInput));

        formContent.appendChild(grid2);

        // Notes
        const notesInput = document.createElement('textarea');
        notesInput.className = 'tv-form-input';
        notesInput.id = 'trade-notes';
        notesInput.placeholder = 'Trade notes...';
        notesInput.rows = 3;
        formContent.appendChild(this.createFormGroup('Notes', notesInput));

        // Buttons
        const btnGroup = document.createElement('div');
        btnGroup.className = 'tv-button-group';

        const saveBtn = this.createButton('Save Trade', {
            variant: 'primary',
            onClick: () => this.saveTrade()
        });

        const clearBtn = this.createButton('Clear', {
            variant: 'secondary',
            onClick: () => this.clearForm()
        });

        btnGroup.appendChild(saveBtn);
        btnGroup.appendChild(clearBtn);

        formContent.appendChild(btnGroup);

        form.appendChild(title);
        form.appendChild(formContent);

        return form;
    }

    renderCalendar(container) {
        container.innerHTML = '';

        // Weekday headers
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const headerRow = document.createElement('div');
        headerRow.className = 'calendar-weekdays';
        
        weekdays.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'calendar-weekday';
            cell.textContent = day;
            headerRow.appendChild(cell);
        });
        container.appendChild(headerRow);

        // Calendar grid
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day empty';
            grid.appendChild(cell);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = this.createDayCell(year, month, day);
            grid.appendChild(cell);
        }

        container.appendChild(grid);
    }

    createDayCell(year, month, day) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        const dateStr = this.formatDate(new Date(year, month, day));
        const dayTrades = this.trades.filter(t => t.date === dateStr);
        const dayPnl = dayTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);

        // Check if today
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            cell.classList.add('today');
        }

        // Day number
        const dayNum = document.createElement('div');
        dayNum.className = 'calendar-day-number';
        dayNum.textContent = day;

        // PNL display
        if (dayTrades.length > 0) {
            const pnlDisplay = document.createElement('div');
            pnlDisplay.className = `calendar-day-pnl ${dayPnl >= 0 ? 'positive' : 'negative'}`;
            pnlDisplay.textContent = `${dayPnl >= 0 ? '+' : ''}$${dayPnl.toFixed(2)}`;
            
            const tradesCount = document.createElement('div');
            tradesCount.className = 'calendar-day-trades';
            tradesCount.textContent = `${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}`;

            cell.appendChild(dayNum);
            cell.appendChild(pnlDisplay);
            cell.appendChild(tradesCount);
            
            cell.classList.add('has-trades');
        } else {
            cell.appendChild(dayNum);
        }

        // Click to view/add trades
        cell.onclick = () => this.selectDate(year, month, day);

        return cell;
    }

    selectDate(year, month, day) {
        this.selectedDate = new Date(year, month, day);
        
        // Update form date
        document.getElementById('trade-date').value = this.formatDateForInput(this.selectedDate);

        // Highlight selected day
        document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
        event.currentTarget.classList.add('selected');

        // Show trades for this day
        this.showDayTrades(this.selectedDate);
    }

    showDayTrades(date) {
        const dateStr = this.formatDate(date);
        const dayTrades = this.trades.filter(t => t.date === dateStr);

        if (dayTrades.length === 0) return;

        // Create trades list popup
        const popup = document.createElement('div');
        popup.className = 'trades-popup';
        popup.innerHTML = `
            <div class="trades-popup-header">
                <h4>Trades on ${date.toLocaleDateString()}</h4>
                <button class="trades-popup-close">×</button>
            </div>
            <div class="trades-popup-content">
                ${dayTrades.map((trade, idx) => `
                    <div class="trade-item">
                        <div class="trade-item-header">
                            <span class="trade-symbol">${trade.symbol}</span>
                            <span class="trade-pnl ${parseFloat(trade.pnl) >= 0 ? 'positive' : 'negative'}">
                                ${parseFloat(trade.pnl) >= 0 ? '+' : ''}$${parseFloat(trade.pnl).toFixed(2)}
                            </span>
                        </div>
                        <div class="trade-item-details">
                            Entry: $${parseFloat(trade.entry).toFixed(2)} | 
                            Exit: $${parseFloat(trade.exit).toFixed(2)} | 
                            ${trade.leverage}x
                        </div>
                        ${trade.notes ? `<div class="trade-item-notes">${trade.notes}</div>` : ''}
                        <button class="trade-delete" data-index="${this.trades.indexOf(trade)}">Delete</button>
                    </div>
                `).join('')}
            </div>
        `;

        document.body.appendChild(popup);

        // Close button
        popup.querySelector('.trades-popup-close').onclick = () => popup.remove();

        // Delete buttons
        popup.querySelectorAll('.trade-delete').forEach(btn => {
            btn.onclick = () => {
                const index = parseInt(btn.getAttribute('data-index'));
                this.deleteTrade(index);
                popup.remove();
            };
        });

        // Click outside to close
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && !e.target.closest('.calendar-day')) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 0);
    }

    saveTrade() {
        const date = document.getElementById('trade-date').value;
        const symbol = document.getElementById('trade-symbol').value.toUpperCase();
        const entry = document.getElementById('trade-entry').value;
        const exit = document.getElementById('trade-exit').value;
        const leverage = document.getElementById('trade-leverage').value;
        const pnl = document.getElementById('trade-pnl').value;
        const notes = document.getElementById('trade-notes').value;

        if (!date || !symbol || !entry || !exit || !pnl) {
            alert('Please fill in all required fields');
            return;
        }

        const trade = {
            id: Date.now(),
            date: date,
            symbol: symbol,
            entry: entry,
            exit: exit,
            leverage: leverage,
            pnl: pnl,
            notes: notes
        };

        this.trades.push(trade);
        this.saveTrades();
        this.clearForm();
        this.refreshCalendar();
        
        alert('Trade saved successfully!');
    }

    deleteTrade(index) {
        if (confirm('Delete this trade?')) {
            this.trades.splice(index, 1);
            this.saveTrades();
            this.refreshCalendar();
        }
    }

    clearForm() {
        document.getElementById('trade-symbol').value = '';
        document.getElementById('trade-entry').value = '';
        document.getElementById('trade-exit').value = '';
        document.getElementById('trade-leverage').value = '10';
        document.getElementById('trade-pnl').value = '';
        document.getElementById('trade-notes').value = '';
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.refreshCalendar();
    }

    goToToday() {
        this.currentDate = new Date();
        this.refreshCalendar();
    }

    refreshCalendar() {
        const calendarView = document.getElementById('calendar-view');
        const monthYear = document.getElementById('calendar-month-year');
        const stats = document.getElementById('calendar-stats');

        this.renderCalendar(calendarView);
        monthYear.textContent = this.getMonthYearText();
        this.updateStats(stats);
    }

    updateStats(container) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthTrades = this.trades.filter(t => {
            const tradeDate = new Date(t.date);
            return tradeDate.getFullYear() === year && tradeDate.getMonth() === month;
        });

        const totalPnl = monthTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
        const winTrades = monthTrades.filter(t => parseFloat(t.pnl) > 0).length;
        const lossTrades = monthTrades.filter(t => parseFloat(t.pnl) < 0).length;
        const winRate = monthTrades.length > 0 ? (winTrades / monthTrades.length * 100).toFixed(1) : 0;

        container.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total PNL</span>
                <span class="stat-value ${totalPnl >= 0 ? 'positive' : 'negative'}">
                    ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}
                </span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Trades</span>
                <span class="stat-value">${monthTrades.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Win Rate</span>
                <span class="stat-value">${winRate}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">W/L</span>
                <span class="stat-value">${winTrades}/${lossTrades}</span>
            </div>
        `;
    }

    getMonthYearText() {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDateForInput(date) {
        return this.formatDate(date);
    }

    loadTrades() {
        const data = localStorage.getItem('trading_calendar_trades');
        return data ? JSON.parse(data) : [];
    }

    saveTrades() {
        localStorage.setItem('trading_calendar_trades', JSON.stringify(this.trades));
    }
}

// Export
window.CalendarProfitDialog = CalendarProfitDialog;
