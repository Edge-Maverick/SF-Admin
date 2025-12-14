import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getCriticalAuditLogs from '@salesforce/apex/AdminSecurityController.getCriticalAuditLogs';

export default class CriticalPermissionWatch extends NavigationMixin(LightningElement) {
    @track displayedLogs = [];
    @track showCriticalOnly = false;
    
    _wiredData = [];

    @wire(getCriticalAuditLogs)
    wiredLogs({ error, data }) {
        if (data) {
            this._wiredData = data;
            this.processLogs();
        } else if (error) {
            console.error('Error fetching logs', error);
        }
    }

    
    get allFilterClass() {
        return `chip ${!this.showCriticalOnly ? 'active' : ''}`;
    }

    get criticalFilterClass() {
        return `chip ${this.showCriticalOnly ? 'active critical' : ''}`;
    }

    get hasLogs() {
        return this.displayedLogs && this.displayedLogs.length > 0;
    }

    checkIsCritical(riskList) {
        return riskList && riskList.length > 0;
    }

    getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    getInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    enhanceLog(log) {
        const isCritical = this.checkIsCritical(log.riskList);
        return {
            ...log,
            relativeTime: this.getRelativeTime(new Date(log.createdDate)),
            markerClass: isCritical ? 'timeline-marker marker-critical' : 'timeline-marker',
            isCritical: isCritical,
            assigneeInitials: this.getInitials(log.assigneeName),
            // Format Active Status
            assigneeActiveDisplay: log.assigneeActive ? 'Active' : 'Inactive',
            activeClass: log.assigneeActive ? 'status-active' : 'status-inactive' 
        };
    }

    processLogs() {
        if (!this._wiredData) return;

        let logs = this._wiredData.map(log => this.enhanceLog(log));

        if (this.showCriticalOnly) {
            logs = logs.filter(log => log.isCritical);
        }

        this.displayedLogs = logs;
    }

    handleFilterAll() {
        this.showCriticalOnly = false;
        this.processLogs();
    }

    handleFilterCritical() {
        this.showCriticalOnly = true;
        this.processLogs();
    }

    handleViewAuditTrail(event) {
        event.preventDefault();
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'Org_Horizon' 
            },
            state: {
                c__section: 'setup_audit_trail'
            }
        });
    }

    handleTargetClick(event) {
        event.preventDefault();
        event.stopPropagation(); // prevent group toggle if clicked inside
        const targetId = event.currentTarget.dataset.id;
        
        if (targetId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: targetId,
                    actionName: 'view'
                }
            });
        }
    }

    // Popover Logic
    @track popoverVisible = false;
    @track activePopoverData = {};
    @track popoverTop = 0;
    @track popoverLeft = 0;
    _popoverTimer;

    get popoverStyle() {
        return `top: ${this.popoverTop}px; left: ${this.popoverLeft}px;`;
    }

    handleUserEnter(event) {
        const logId = event.target.dataset.id;
        const log = this.displayedLogs.find(l => l.id === logId);

        if (log) {
            this.activePopoverData = log;
            
            const rect = event.target.getBoundingClientRect();
            // Position above the text, centered
            this.popoverTop = rect.top - 160; // Approximate height of popover + padding
            this.popoverLeft = rect.left + (rect.width / 2) - 120; // Center (240px width / 2)

            // Boundary checks could be added here if needed
            
            this.popoverVisible = true;
            this.clearPopoverTimer();
        }
    }

    handleUserLeave() {
        // Small delay to allow moving into the popover itself if needed
        this._popoverTimer = setTimeout(() => {
            this.popoverVisible = false;
        }, 100);
    }

    handlePopoverEnter() {
        this.clearPopoverTimer();
    }

    clearPopoverTimer() {
        if (this._popoverTimer) {
            clearTimeout(this._popoverTimer);
            this._popoverTimer = null;
        }
    }

    renderedCallback() {
        if (this.popoverVisible && this.refs.popover) {
            this.refs.popover.style.top = `${this.popoverTop}px`;
            this.refs.popover.style.left = `${this.popoverLeft}px`;
        }
    }
}
