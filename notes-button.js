// Notes Button - Opens iframe modal to https://ghichu.vercel.app
(function () {
    'use strict';

    function initNotesButton() {
        if (typeof window.tvWidget === 'undefined' || !window.tvWidget) {
            setTimeout(initNotesButton, 100);
            return;
        }

        const tvWidget = window.tvWidget;

        tvWidget.onChartReady(() => {
            tvWidget.headerReady().then(() => {
                createNotesButton(tvWidget);
            });
        });
    }

    function createNotesButton(tvWidget) {
        // Create button in toolbar
        const button = tvWidget.createButton({ align: 'left' });
        
        button.setAttribute('title', 'Ghi chú');
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
        `;
        button.style.cssText = 'padding: 8px; cursor: pointer;';

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            openNotesModal();
        });
    }

    function openNotesModal() {
        // Check if modal already exists
        if (document.getElementById('notes-modal')) {
            return;
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'notes-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease-in-out;
        `;

        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.style.cssText = `
            width: 80vw;
            height: 80vh;
            background: #1e222d;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            animation: slideIn 0.3s ease-out;
        `;

        // Create modal header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: #131722;
            border-bottom: 1px solid #2a2e39;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Ghi chú';
        title.style.cssText = `
            margin: 0;
            color: #d1d4dc;
            font-size: 16px;
            font-weight: 600;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        closeButton.style.cssText = `
            background: transparent;
            border: none;
            color: #787b86;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
        `;
        closeButton.onmouseover = () => {
            closeButton.style.background = '#2a2e39';
            closeButton.style.color = '#d1d4dc';
        };
        closeButton.onmouseout = () => {
            closeButton.style.background = 'transparent';
            closeButton.style.color = '#787b86';
        };
        closeButton.onclick = closeNotesModal;

        header.appendChild(title);
        header.appendChild(closeButton);

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.src = 'https://ghichu.vercel.app';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            flex: 1;
        `;

        // Assemble modal
        modalContainer.appendChild(header);
        modalContainer.appendChild(iframe);
        overlay.appendChild(modalContainer);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeNotesModal();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', handleEscKey);
    }

    function closeNotesModal() {
        const modal = document.getElementById('notes-modal');
        if (modal) {
            modal.style.animation = 'fadeOut 0.2s ease-in-out';
            setTimeout(() => {
                modal.remove();
                document.removeEventListener('keydown', handleEscKey);
            }, 200);
        }
    }

    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeNotesModal();
        }
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideIn {
            from { 
                transform: scale(0.9) translateY(-20px);
                opacity: 0;
            }
            to { 
                transform: scale(1) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotesButton);
    } else {
        initNotesButton();
    }
})();
