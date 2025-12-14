import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSetupAuditTrailLogs from '@salesforce/apex/SetupAuditTrailController.getSetupAuditTrailLogs';

export default class SetupAuditTrailViewer extends LightningElement {
    @track startDate;
    @track endDate;
    @track groupedLogs = [];
    @track isLoading = false;
    @track isLoadingMore = false; // Separate spinner for "Load More"
    @track error;
    
    @track sectionOptions = [];
    @track selectedSection = 'All';
    @track activeSections = [];
    @track showCriticalOnly = false;
    @track searchTerm = '';
    @track isFilterOpen = true;
    
    // Pagination tracking
    rawLogs = []; 
    hasMoreData = false;
    _fetchTimeout; // For debouncing

    get skeletonItems() {
        return [1, 2, 3];
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
        this.fetchLogs(true); // Initial fetch
    }

    setDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        
        this.endDate = end.toISOString().slice(0, 10);
        this.startDate = start.toISOString().slice(0, 10);
    }

    // --- Filter Handlers (Debounced) ---

    handleStartDateChange(event) {
        this.startDate = event.target.value;
        this.debouncedFetch();
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
        this.debouncedFetch();
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.filterLogs(); // Client-side filter only, no need to fetch
    }

    handleSectionChange(event) {
        this.selectedSection = event.detail.value;
        this.filterLogs();
    }

    handleCriticalChange(event) {
        this.showCriticalOnly = event.target.checked;
        this.filterLogs();
    }

    toggleFilterDrawer() {
        this.isFilterOpen = !this.isFilterOpen;
    }

    handleRefresh() {
        this.fetchLogs(true);
    }

    handleClearFilters() {
        this.selectedSection = 'All';
        this.showCriticalOnly = false;
        this.searchTerm = '';
        this.setDateRange(7);
        this.fetchLogs(true);
    }

    // --- Validation ---

    validateDateRange() {
        const start = new Date(this.startDate);
        const end = new Date(this.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays > 7) {
            this.showToast('Error', 'Date range cannot exceed 7 days.', 'error');
            this.error = 'Date range cannot exceed 7 days.';
            return false;
        }
        if (start > end) {
             this.showToast('Error', 'Start Date cannot be after End Date.', 'error');
             this.error = 'Start Date cannot be after End Date.';
             return false;
        }
        this.error = undefined;
        return true;
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

    // --- Data Fetching ---

    debouncedFetch() {
        // Clear existing timeout
        if (this._fetchTimeout) {
            clearTimeout(this._fetchTimeout);
        }
        // Set new timeout (500ms debounce)
        this._fetchTimeout = setTimeout(() => {
            this.fetchLogs(true);
        }, 800);
    }

    loadMore() {
        this.fetchLogs(false);
    }

    fetchLogs(reset = false) {
        if (!this.validateDateRange()) {
            this.groupedLogs = [];
            return;
        }

        if (reset) {
            this.isLoading = true;
            this.rawLogs = [];
            this.groupedLogs = [];
        } else {
            this.isLoadingMore = true;
        }
        
        // Prepare Pagination Params
        let lastCreatedDate = null;
        let lastId = null;

        if (!reset && this.rawLogs.length > 0) {
            const lastLog = this.rawLogs[this.rawLogs.length - 1];
            lastCreatedDate = lastLog.createdDate;
            lastId = lastLog.id;
        }

        getSetupAuditTrailLogs({ 
            request: {
                startDate: this.startDate, 
                endDate: this.endDate,
                lastCreatedDate: lastCreatedDate,
                lastId: lastId
            }
        })
        .then(result => {
            if (result && result.length > 0) {
                // Append or Set
                if (reset) {
                    this.rawLogs = result;
                } else {
                    this.rawLogs = [...this.rawLogs, ...result];
                }
                
                // If we got exactly 1000 records, there are likely more.
                this.hasMoreData = result.length === 1000;
                
                this.processLogs();
            } else {
                this.hasMoreData = false;
                if (reset) {
                    this.groupedLogs = [];
                    this.sectionOptions = [];
                }
            }
        })
        .catch(error => {
            this.error = error.body ? error.body.message : error.message;
            this.showToast('Error fetching logs', this.error, 'error');
        })
        .finally(() => {
            this.isLoading = false;
            this.isLoadingMore = false;
        });
    }

    processLogs() {
        if (!this.rawLogs || this.rawLogs.length === 0) {
            this.groupedLogs = [];
            this.sectionOptions = [];
            return;
        }

        // Extract Sections for Filter Dropdown
        const sections = new Set();
        this.rawLogs.forEach(log => {
            sections.add(log.section || 'Other');
        });

        // Only rebuild options if it's a fresh fetch or options list grew
        if (this.sectionOptions.length <= 1 || sections.size > (this.sectionOptions.length - 1)) {
            const options = [{ label: 'All Sections', value: 'All' }];
            Array.from(sections).sort().forEach(section => {
                options.push({ label: section, value: section });
            });
            this.sectionOptions = options;
        }

        this.filterLogs();
    }

    filterLogs() {
        const groups = {};
        
        this.rawLogs.forEach(log => {
            // Level 1: Filter by Critical Toggle
            if (this.showCriticalOnly && !this.isCritical(log.action)) {
                return; 
            }

            // Level 2: Filter by Section
            const section = log.section || 'Other';
            if (this.selectedSection === 'All' || this.selectedSection === section) {
                
                // Level 3: Text Search
                if (this.searchTerm) {
                    const term = this.searchTerm.toLowerCase();
                    const match = (log.action && log.action.toLowerCase().includes(term)) ||
                                  (log.display && log.display.toLowerCase().includes(term)) ||
                                  (log.createdByName && log.createdByName.toLowerCase().includes(term));
                    if (!match) return; 
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
                formattedDate: this.formatDate(new Date(log.createdDate)),
                rowClass: this.getRowClass(log.action)
            }));
            
            const totalCount = items.length;
            const criticalCount = items.filter(i => this.isCritical(i.action)).length;
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

        // Open active sections if not already set by user interaction
        if (this.activeSections.length === 0 && this.groupedLogs.length > 0) {
             this.activeSections = this.groupedLogs
            .filter(g => g.hasCritical)
            .map(g => g.section);
            
            if (this.activeSections.length === 0) {
                 this.activeSections = [this.groupedLogs[0].section];
            }
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