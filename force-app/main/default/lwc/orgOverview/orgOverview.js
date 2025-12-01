import { LightningElement, track, wire } from 'lwc';
import getOrganizationDetails from '@salesforce/apex/OrgOverviewController.getOrganizationDetails';
import getUpcomingRelease from '@salesforce/apex/OrgOverviewController.getUpcomingRelease';
import getTrustInfo from '@salesforce/apex/OrgOverviewController.getTrustInfo';

export default class OrgOverview extends LightningElement {
    @track isContentVisible = true; 
    @track orgDetails;
    @track error;
    @track releaseInfo;
    @track isDrawerOpen = false;
    @track trustInfo;
    
    quickLaunchItems = [
        { label: 'Org Settings', icon: 'utility:settings', url: '/lightning/setup/SetupOneHome/home' },
        { label: 'Accounts', icon: 'utility:account', url: '/lightning/setup/OrgHealth/home' },
        { label: 'Users', icon: 'utility:user', url: '/lightning/setup/ManageUsers/home' },
        { label: 'Reports', icon: 'utility:report', url: '/lightning/o/Report/home' }
    ];

    @wire(getOrganizationDetails)
    wiredOrgDetails({ error, data }) {
        if (data) {
            this.orgDetails = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.orgDetails = undefined;
        }
    }

    @wire(getUpcomingRelease)
    wiredReleaseInfo({ error, data }) {
        if (data) {
            this.releaseInfo = data;
        } else if (error) {
            console.error('Error fetching release info', error);
        }
    }

    @wire(getTrustInfo)
    wiredTrustInfo({ error, data }) {
        if (data) {
            this.trustInfo = data;
        } else if (error) {
            console.error('Error fetching trust info', error);
        }
    }

    get iconName() {
        return this.isContentVisible ? 'utility:chevronup' : 'utility:chevrondown';
    }

    get buttonLabel() {
        return this.isContentVisible ? 'Collapse' : 'Expand';
    }

    get contentClass() {
        return this.isContentVisible ? 'content-visible' : 'content-hidden';
    }

    get orgTypeLabel() {
        if (this.orgDetails) {
            return this.orgDetails.OrganizationType + ' • ' + this.orgDetails.InstanceName;
        }
        return 'Loading...';
    }

    get sandboxLabel() {
        if (this.orgDetails && this.orgDetails.IsSandbox) {
            return 'Sandbox';
        }
        return 'Production';
    }

    get sandboxBadgeClass() {
        return this.orgDetails && this.orgDetails.IsSandbox ? 'slds-badge slds-theme_warning' : 'slds-badge slds-theme_success';
    }

    toggleContent() {
        this.isContentVisible = !this.isContentVisible;
    }

    handleDismissRelease() {
        this.releaseInfo = null;
    }

    // Drawer Logic
    handleOpenDrawer() {
        this.isDrawerOpen = true;
    }

    handleCloseDrawer() {
        this.isDrawerOpen = false;
    }

    get hasActiveIncidents() {
        return this.trustInfo && this.trustInfo.activeIncidents && this.trustInfo.activeIncidents.length > 0;
    }

    get activeIncidents() {
        return this.trustInfo ? this.trustInfo.activeIncidents : [];
    }

    get pastIncidents() {
        return this.trustInfo ? this.trustInfo.pastIncidents : [];
    }

    get nextUpdateName() {
        return this.trustInfo ? this.trustInfo.nextReleaseName : 'Unknown';
    }

    get nextUpdateDate() {
        return this.trustInfo ? this.trustInfo.nextReleaseDate : 'Unknown';
    }

    get releaseVersion() {
        return this.trustInfo ? this.trustInfo.releaseVersion : 'Unknown';
    }

    get apiLevel() {
        return this.trustInfo ? this.trustInfo.apiLevel : 'Unknown';
    }

    /**
     * Toggles the sticky note board visibility.
     */
    toggleStickyBoard() {
        const board = this.template.querySelector('c-sticky-note-board');
        if (board) {
            board.toggleBoard();
        }
    }
}