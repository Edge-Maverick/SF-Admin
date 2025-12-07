import { LightningElement, track } from 'lwc';
import scanOrg from '@salesforce/apex/OptimizerController.scanOrg';

export default class Optimizer extends LightningElement {
    @track isScanning = false;
    @track scanResults;
    @track error;

    handleScan() {
        this.runScan(true);
    }
    
    connectedCallback(){
        this.runScan(false);
    }

    runScan(force) {
        this.isScanning = true;
        this.error = undefined;
        // Keep results if forcing a refresh, until new ones arrive? Or clear them?
        // Let's keep them to avoid flicker if just refreshing, but maybe clear if it's a fresh load.
        if(!this.scanResults) this.scanResults = undefined; 

        scanOrg({ forceScan: force })
            .then(result => {
                this.scanResults = result;
                this.isScanning = false;
            })
            .catch(error => {
                this.error = error;
                this.isScanning = false;
                console.error('Scan failed', error);
            });
    }

    get lastScannedDate() {
        return this.scanResults?.lastScanned ? new Date(this.scanResults.lastScanned).toLocaleString() : '';
    }

    get scanButtonLabel() {
        return this.hasResults ? 'Refresh Scan' : 'Scan Technical Debt';
    }

    get hasResults() {
        return this.scanResults !== undefined;
    }

    get unusedProfilesCount() {
        return this.scanResults?.unusedProfiles?.length || 0;
    }
    
    get unusedPermSetsCount() {
        return this.scanResults?.unusedPermissionSets?.length || 0;
    }

    get privilegedUsersCount() {
        return this.scanResults?.privilegedUsers?.length || 0;
    }

    get hardCodedUrlsCount() {
        return this.scanResults?.hardCodedUrlClasses?.length || 0;
    }

    get unassignedRolesCount() {
        return this.scanResults?.unassignedRoles?.length || 0;
    }

    get neverLoggedInUsersCount() {
        return this.scanResults?.neverLoggedInUsers?.length || 0;
    }

    get staleReportsCount() {
        return this.scanResults?.staleReports?.length || 0;
    }

    get emptyPublicGroupsCount() {
        return this.scanResults?.emptyPublicGroups?.length || 0;
    }

    get oldApiClassesCount() {
        return this.scanResults?.oldApiClasses?.length || 0;
    }

    get activeProcessBuildersCount() {
        return this.scanResults?.activeProcessBuilders?.length || 0;
    }

    // --- Severity Logic ---
    get unusedProfilesClass() {
        return this.getSeverityClass(this.unusedProfilesCount, 5, 20);
    }
    // ... existing ... 
    get emptyPublicGroupsClass() {
        return this.getSeverityClass(this.emptyPublicGroupsCount, 5, 20);
    }
    get oldApiClassesClass() {
        return this.getSeverityClass(this.oldApiClassesCount, 5, 20);
    }
    get activeProcessBuildersClass() {
        return this.getSeverityClass(this.activeProcessBuildersCount, 1, 5); // Encourage migration
    }

    getSeverityClass(count, mediumThreshold, highThreshold) {
        if (count >= highThreshold) return 'metric-card severity-high';
        if (count >= mediumThreshold) return 'metric-card severity-medium';
        if (count > 0) return 'metric-card severity-low';
        return 'metric-card severity-safe';
    }
    get unusedPermSetsClass() {
        return this.getSeverityClass(this.unusedPermSetsCount, 5, 20);
    }
    get privilegedUsersClass() {
        return this.getSeverityClass(this.privilegedUsersCount, 1, 5); // Stricter for admins
    }
    get hardCodedUrlsClass() {
        return this.getSeverityClass(this.hardCodedUrlsCount, 1, 10);
    }
    get unassignedRolesClass() {
        return this.getSeverityClass(this.unassignedRolesCount, 5, 20);
    }
    get neverLoggedInUsersClass() {
        return this.getSeverityClass(this.neverLoggedInUsersCount, 5, 50);
    }
    get staleReportsClass() {
        return this.getSeverityClass(this.staleReportsCount, 10, 100);
    }
    get emptyPublicGroupsClass() {
        return this.getSeverityClass(this.emptyPublicGroupsCount, 5, 20);
    }

    getSeverityClass(count, mediumThreshold, highThreshold) {
        if (count >= highThreshold) return 'metric-card severity-high';
        if (count >= mediumThreshold) return 'metric-card severity-medium';
        if (count > 0) return 'metric-card severity-low';
        return 'metric-card severity-safe';
    }

    // --- Modal Logic ---
    @track isModalOpen = false;
    @track modalTitle = '';
    @track modalData = [];
    @track modalColumns = [
        { label: 'Name', fieldName: 'name', type: 'text' },
        { label: 'Type', fieldName: 'type', type: 'text' },
        { label: 'Action', type: 'button', typeAttributes: { label: 'View', name: 'view', title: 'Open in Setup' } }
    ];

    handleCardClick(event) {
        const metric = event.currentTarget.dataset.metric;
        if (!metric) return;

        this.configureModal(metric);
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.modalData = [];
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'view') {
            this.navigateToRecord(row.id);
        }
    }

    navigateToRecord(recordId) {
        // Simple navigation to record page
        // Since we are in an app, we can use standard navigation mixin if extended, 
        // or just window.open for now as some of these are setup objects not standard records.
        // For actual setup objects, navigation is tricky. Let's try standard record nav first.
        // Note: Lightning NavigationMixin is needed.
        window.open('/' + recordId, '_blank');
    }

    configureModal(metric) {
        switch (metric) {
            case 'unusedProfiles':
                this.modalTitle = 'Unused Custom Profiles';
                this.modalData = this.scanResults?.unusedProfiles || [];
                break;
            case 'unusedPermSets':
                this.modalTitle = 'Unused Permission Sets';
                this.modalData = this.scanResults?.unusedPermissionSets || [];
                break;
            case 'privilegedUsers':
                this.modalTitle = 'Privileged Users (Admin)';
                this.modalData = this.scanResults?.privilegedUsers || [];
                break;
            case 'hardCodedUrls':
                this.modalTitle = 'Apex Classes with Hard-coded URLs';
                this.modalData = this.scanResults?.hardCodedUrlClasses || [];
                break;
            case 'unassignedRoles':
                this.modalTitle = 'Unassigned Roles';
                this.modalData = this.scanResults?.unassignedRoles || [];
                break;
            case 'neverLoggedInUsers':
                this.modalTitle = 'Never Logged In Users (>30 Days)';
                this.modalData = this.scanResults?.neverLoggedInUsers || [];
                break;
            case 'staleReports':
                this.modalTitle = 'Stale Reports (>12 Months)';
                this.modalData = this.scanResults?.staleReports || [];
                break;
            case 'emptyPublicGroups':
                this.modalTitle = 'Empty Public Groups';
                this.modalData = this.scanResults?.emptyPublicGroups || [];
                break;
            case 'oldApiClasses':
                this.modalTitle = 'Old API Version Classes (< v55.0)';
                this.modalData = this.scanResults?.oldApiClasses || [];
                break;
            case 'activeProcessBuilders':
                this.modalTitle = 'Active Process Builders (Consider Flow)';
                this.modalData = this.scanResults?.activeProcessBuilders || [];
                break;
        }
    }
}
