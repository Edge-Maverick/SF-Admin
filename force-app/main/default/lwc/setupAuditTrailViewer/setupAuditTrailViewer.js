import { LightningElement, track } from 'lwc';
import getSetupAuditTrailLogs from '@salesforce/apex/SetupAuditTrailController.getSetupAuditTrailLogs';

export default class SetupAuditTrailViewer extends LightningElement {
    @track startDate;
    @track endDate;
    @track groupedLogs = [];
    @track isLoading = false;
    @track error;
    
    @track sectionOptions = [];
    @track selectedSection = 'All';
    @track activeSections = [];
    
    rawLogs = []; // Store all logs to allow client-side filtering

    connectedCallback() {
        // Default to last 7 days
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        
        this.endDate = end.toISOString().slice(0, 10);
        this.startDate = start.toISOString().slice(0, 10);

        this.fetchLogs();
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
    }

    handleSectionChange(event) {
        this.selectedSection = event.detail.value;
        this.filterLogs();
    }

    handleFilter() {
        this.fetchLogs();
    }

    get isFilterDisabled() {
        return !this.sectionOptions || this.sectionOptions.length === 0;
    }

    fetchLogs() {
        this.isLoading = true;
        this.error = undefined;
        this.groupedLogs = [];
        this.sectionOptions = [];
        this.selectedSection = 'All';

        getSetupAuditTrailLogs({ startDate: this.startDate, endDate: this.endDate })
            .then(result => {
                this.rawLogs = result || [];
                this.processLogs();
                this.isLoading = false;
            })
            .catch(error => {
                this.error = error.body ? error.body.message : error.message;
                this.isLoading = false;
                console.error('Error fetching logs:', error);
            });
    }

    processLogs() {
        if (!this.rawLogs || this.rawLogs.length === 0) {
            this.groupedLogs = [];
            this.sectionOptions = [];
            return;
        }

        // Extract unique sections
        const sections = new Set();
        this.rawLogs.forEach(log => {
            sections.add(log.Section || 'Other');
        });

        // Build options
        const options = [{ label: 'All Sections', value: 'All' }];
        Array.from(sections).sort().forEach(section => {
            options.push({ label: section, value: section });
        });
        this.sectionOptions = options;

        this.filterLogs();
    }

    filterLogs() {
        const groups = {};
        
        this.rawLogs.forEach(log => {
            const section = log.Section || 'Other';
            
            // Filter based on selection
            if (this.selectedSection === 'All' || this.selectedSection === section) {
                if (!groups[section]) {
                    groups[section] = [];
                }
                groups[section].push(log);
            }
        });

        // Convert to array and sort by section name
        this.groupedLogs = Object.keys(groups).sort().map(section => {
            return {
                section: section,
                items: groups[section]
            };
        });

        // Open all sections by default
        this.activeSections = this.groupedLogs.map(group => group.section);
    }

    get hasLogs() {
        return this.groupedLogs && this.groupedLogs.length > 0;
    }
}
