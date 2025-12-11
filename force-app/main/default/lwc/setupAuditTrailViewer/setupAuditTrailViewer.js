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
    @track showCriticalOnly = false;
    @track searchTerm = '';
    @track isFilterOpen = true; // Default open for visibility
    
    rawLogs = []; 

    get skeletonItems() {
        return [1, 2, 3]; // Fewer items for groups
    }

    get filterDrawerClass() {
        return `filter-drawer ${this.isFilterOpen ? 'drawer-open' : 'drawer-closed'} slds-var-m-bottom_medium`;
    }

    get filterButtonVariant() {
        return this.isFilterOpen ? 'brand' : 'border-filled';
    }

    connectedCallback() {
        // Default to last 7 days
        this.setDateRange(7);
        this.fetchLogs();
    }

    setDateRange(days) {
        const end = new Date();
        const start = new Date();
        if (days === '24h') {
             start.setDate(end.getDate() - 1); // Exact 24h logic could be precise, but day-based is usually fine for audit logs
        } else {
             start.setDate(end.getDate() - days);
        }
        
        this.endDate = end.toISOString().slice(0, 10);
        this.startDate = start.toISOString().slice(0, 10);
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.filterLogs();
    }



    toggleFilterDrawer() {
        this.isFilterOpen = !this.isFilterOpen;
    }

    handleSectionChange(event) {
        this.selectedSection = event.detail.value;
        this.filterLogs();
    }

    handleCriticalChange(event) {
        this.showCriticalOnly = event.target.checked;
        this.filterLogs();
    }

    handleRefresh() {
        this.fetchLogs();
    }

    handleClearFilters() {
        this.selectedSection = 'All';
        this.showCriticalOnly = false;
        this.setDateRange(7); // Reset to default 7 days
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
                setTimeout(() => {
                    this.isLoading = false;
                }, 400);
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

        const sections = new Set();
        this.rawLogs.forEach(log => {
            sections.add(log.Section || 'Other');
        });

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
            // Level 1: Filter by Critical Toggle
            if (this.showCriticalOnly && !this.isCritical(log.Action)) {
                return; // Skip non-critical if toggle is on
            }

            // Level 2: Filter by Section
            const section = log.Section || 'Other';
            if (this.selectedSection === 'All' || this.selectedSection === section) {
                
                // Level 3: Text Search
                if (this.searchTerm) {
                    const term = this.searchTerm.toLowerCase();
                    const match = (log.Action && log.Action.toLowerCase().includes(term)) ||
                                  (log.Display && log.Display.toLowerCase().includes(term)) ||
                                  (log.CreatedByName && log.CreatedByName.toLowerCase().includes(term));
                    if (!match) return; // Skip if no match
                }

                if (!groups[section]) {
                    groups[section] = [];
                }
                groups[section].push(log);
            }
        });

        this.groupedLogs = Object.keys(groups).map(section => {
            const items = groups[section].map(log => ({
                ...log,
                formattedDate: this.formatDate(new Date(log.CreatedDate)),
                rowClass: this.getRowClass(log.Action)
            }));
            
            const totalCount = items.length;
            const criticalCount = items.filter(i => this.isCritical(i.Action)).length;
            const hasCritical = criticalCount > 0;
            
            return {
                section: section,
                items: items,
                totalCount: totalCount,
                criticalCount: criticalCount,
                hasCritical: hasCritical,
                badgeClass: hasCritical ? 'slds-badge slds-theme_error' : 'slds-badge slds-theme_light',
                iconName: hasCritical ? 'utility:warning' : 'utility:list',
                iconVariant: hasCritical ? 'error' : '',
                wrapperClass: `section-card ${hasCritical ? 'critical-section' : ''}`
            };
        });

        // Smart Sort
        this.groupedLogs.sort((a, b) => {
            if (a.hasCritical && !b.hasCritical) return -1;
            if (!a.hasCritical && b.hasCritical) return 1;
            return a.section.localeCompare(b.section);
        });

        // Open active sections
        this.activeSections = this.groupedLogs
            .filter(g => g.hasCritical)
            .map(g => g.section);
         
         if (this.activeSections.length === 0 && this.groupedLogs.length > 0) {
             this.activeSections = [this.groupedLogs[0].section];
         }
    }

    formatDate(date) {
        return date.toLocaleString([], { 
            month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    }



    isCritical(action) {
        if (!action) return false;
        const lower = action.toLowerCase();
        return lower.includes('delete') || lower.includes('remove') || lower.includes('failed') || lower.includes('expire');
    }

    getRowClass(action) {
        return this.isCritical(action) ? 'critical-row' : '';
    }

    get hasLogs() {
        return this.groupedLogs && this.groupedLogs.length > 0;
    }
}