import { LightningElement } from 'lwc';

export default class AdminCommandConsole extends LightningElement {
    
    connectedCallback() {
        window.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this.handleKeydown.bind(this));
    }

    handleKeydown(event) {
        // Ctrl + K or Cmd + K to open terminal
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.handleTerminalOpen();
        }
    }

    handleTerminalOpen() {
        const terminal = this.template.querySelector('c-admin-terminal');
        if (terminal) {
            terminal.open();
        }
    }
}
