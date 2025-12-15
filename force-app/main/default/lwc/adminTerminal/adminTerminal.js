import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import executeCommandApex from '@salesforce/apex/AdminTerminalController.executeCommand';

export default class AdminTerminal extends NavigationMixin(LightningElement) {
    @track isVisible = false;
    history = [];
    historyIndex = -1;
    isProcessing = false;

    @api
    open() {
        this.isVisible = true;
        // Focus input after render
        setTimeout(() => {
            const input = this.template.querySelector('.cmd-input');
            if(input) input.focus();
        }, 100);
    }

    @api
    close() {
        this.isVisible = false;
    }

    closeTerminal() {
        this.isVisible = false;
    }

    handleOverlayClick(event) {
        if (event.target.classList.contains('terminal-overlay')) {
            this.closeTerminal();
        }
    }

    handleWindowClick(event) {
        event.stopPropagation();
        const input = this.template.querySelector('.cmd-input');
        if(input) input.focus();
    }

    handleKeyUp(event) {
        if (event.key === 'Enter') {
            const input = event.target;
            const command = input.value;
            
            if (command.trim()) {
                this.processCommand(command);
                this.history.push(command);
                this.historyIndex = this.history.length;
                input.value = '';
            }
        } else if (event.key === 'ArrowUp') {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                event.target.value = this.history[this.historyIndex];
            }
        } else if (event.key === 'ArrowDown') {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                event.target.value = this.history[this.historyIndex];
            } else {
                this.historyIndex = this.history.length;
                event.target.value = '';
            }
        } else if (event.key === 'Escape') {
            this.closeTerminal();
        }
    }

    @track themeClass = '';
    lastTableData = null;

    get windowClass() {
        return `terminal-window glass-panel ${this.themeClass}`;
    }

    async processCommand(cmdStr) {
        const cleanCmd = cmdStr.trim();
        this.printOutput(`➜ ${cleanCmd}`, 'cmd');

        if (cleanCmd.toLowerCase() === 'clear') {
            this.clearScreen();
            return;
        }
        
        if (cleanCmd.toLowerCase() === 'help') {
            this.printHelp();
            return;
        }

        if (cleanCmd.toLowerCase() === 'exit') {
            this.closeTerminal();
            return;
        }

        if (cleanCmd.toLowerCase().startsWith('goto ')) {
            this.handleGoto(cleanCmd);
            return;
        }

        if (cleanCmd.toLowerCase().startsWith('theme ')) {
            this.handleTheme(cleanCmd);
            return;
        }

        if (cleanCmd.toLowerCase() === 'export') {
            this.handleExport();
            return;
        }

        this.isProcessing = true;
        // Show loading indicator (simulated)
        const loadingId = this.printOutput('Processing...', 'info');

        try {
            const result = await executeCommandApex({ command: cleanCmd });
            
            this.removeLine(loadingId);

            if (result.success) {
                if (result.outputType === 'TABLE' && result.data) {
                    this.printTable(result.data);
                } else if (result.outputType === 'LOGIN') {
                    this.printOutput(result.message, 'success');
                    this[NavigationMixin.Navigate]({
                        type: 'standard__webPage',
                        attributes: { url: result.data } 
                    });
                    this.closeTerminal();
                } else {
                    this.printOutput(result.message, 'success');
                }
            } else {
                this.printOutput(result.message, 'error');
            }
        } catch (error) {
            this.removeLine(loadingId);
            this.printOutput(`System Error: ${error.body ? error.body.message : error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    handleGoto(cmd) {
        const target = cmd.split(' ')[1].toLowerCase();
        try {
            if (target === 'setup') {
                 this[NavigationMixin.Navigate]({
                    type: 'standard__webPage',
                    attributes: { url: '/lightning/setup/SetupOneHome/home' }
                });
            } else if (target === 'flows') {
                 this[NavigationMixin.Navigate]({
                    type: 'standard__webPage',
                    attributes: { url: '/lightning/setup/Flows/home' }
                });
            } else if (target === 'objects') {
                 this[NavigationMixin.Navigate]({
                    type: 'standard__webPage',
                    attributes: { url: '/lightning/setup/ObjectManager/home' }
                });
            } else {
                 this.printOutput(`Unknown destination: ${target}.`, 'warn');
                 return;
            }
            this.printOutput(`Navigating to ${target}...`, 'success');
            this.closeTerminal();
        } catch (e) {
            this.printOutput('Navigation failed.', 'error');
        }
    }

    handleTheme(cmd) {
        const theme = cmd.split(' ')[1];
        if (theme === 'matrix') {
            this.themeClass = 'theme-matrix';
            this.printOutput('Theme set to Matrix.', 'success');
        } else if (theme === 'retro') {
            this.themeClass = 'theme-retro';
            this.printOutput('Theme set to Retro.', 'success');
        } else {
            this.themeClass = '';
            this.printOutput('Theme reset to Default.', 'success');
        }
    }

    handleExport() {
        try {
            if (!this.lastTableData || this.lastTableData.length === 0) {
                this.printOutput('No data to export. Run a query first.', 'warn');
                return;
            }

            // CSV Generation
            const headers = Object.keys(this.lastTableData[0]).filter(k => k !== 'attributes');
            let csvContent = headers.join(',') + '\n';
            
            this.lastTableData.forEach(row => {
                const rowData = headers.map(h => {
                    let val = row[h];
                    if (typeof val === 'object' && val !== null) {
                        val = val.Name || val.Id || '';
                    } else if (val === undefined || val === null) {
                        val = '';
                    }
                    const stringVal = String(val).replace(/"/g, '""');
                    return `"${stringVal}"`;
                });
                csvContent += rowData.join(',') + '\n';
            });

            // Download
            const blob = new Blob([csvContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `terminal_export_${Date.now()}.csv`);
            link.style.visibility = 'hidden';
            this.template.appendChild(link); // Use template instead of body for LWC safety
            link.click();
            
            // Cleanup - slight delay to ensure click registers
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                this.template.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            this.printOutput('Export started. Check your downloads.', 'success');
        } catch (e) {
            this.printOutput('Export failed: ' + e.message, 'error');
            console.error(e);
        }
    }

    printOutput(text, type = '') {
        const body = this.template.querySelector('.terminal-body');
        if (!body) return null;

        const div = document.createElement('div');
        const id = 'line-' + Date.now();
        div.id = id;
        div.className = `output-line ${type}`;
        div.innerText = text;
        body.appendChild(div);
        
        body.scrollTop = body.scrollHeight;
        return id;
    }

    removeLine(id) {
        if(!id) return;
        const body = this.template.querySelector('.terminal-body');
        const el = body.querySelector('#' + id);
        if(el) el.remove();
    }

    printTable(data) {
        if (!data || data.length === 0) return;
        
        this.lastTableData = data; // Store for export

        const body = this.template.querySelector('.terminal-body');
        const table = document.createElement('table');
        table.className = 'terminal-table';
        
        // Headers
        const headers = Object.keys(data[0]).filter(k => k !== 'attributes');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.innerText = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(h => {
                const td = document.createElement('td');
                const val = row[h];
                if (typeof val === 'object' && val !== null) {
                    td.innerText = val.Name || val.Id || '[Object]';
                } else {
                    td.innerText = val !== undefined && val !== null ? val : '';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        body.appendChild(table);
        body.scrollTop = body.scrollHeight;
        
        this.printOutput(`${data.length} rows returned. Type "export" to download CSV.`, 'info');
    }

    printHelp() {
        const helpText = `
Available Commands:
  help                    - Show this help message
  clear                   - Clear the terminal screen
  exit                    - Close the terminal
  theme [matrix/retro]    - Change terminal theme
  export                  - Download current table as CSV
  goto [place]            - Navigate to 'setup', 'flows', or 'objects'
  
  // User Management
  login as [User]         - Log in as another user
  show/list users         - List recent active users
  freeze [User]           - Freeze a user account
  unfreeze [User]         - Unfreeze a user account
  unlock [User]           - Unlock a user account
  reset password [User]   - Send password reset email
  assign [Perm] to [User] - Assign Permission Set
  
  // Security Intelligence
  audit privileges        - Summary of High-Risk permissions
  check perm [ApiName]    - List users with specific permission

  // DevOps & Utils
  limits                  - View Org Limits Snapshot
  cancel all jobs         - STOP active Apex/Queueable jobs
  logs                    - View recent Debug Logs
  describe [Object]       - List fields and types
  count [Object]          - Count records
  whois [Id]              - Identify Object from ID
  create [Obj] [Name]     - Quick create record
  
  // Search & Query
  search [Term]           - Global SOSL search
  SELECT ...              - Run any SOQL query
`;
        this.printOutput(helpText, 'info');
    }

    clearScreen() {
        const body = this.template.querySelector('.terminal-body');
        if (body) {
            body.innerHTML = '';
        }
        this.lastTableData = null;
    }
}
