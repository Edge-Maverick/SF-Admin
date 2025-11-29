import { LightningElement, track, wire } from 'lwc';
import getOrganizationDetails from '@salesforce/apex/OrgOverviewController.getOrganizationDetails';
import getUpcomingRelease from '@salesforce/apex/OrgOverviewController.getUpcomingRelease';

export default class OrgOverview extends LightningElement {
    @track isContentVisible = true; 
    @track orgDetails;
    @track error;
    @track releaseInfo;
    quickLaunchItems = [
        { label: 'Org Settings', icon: 'utility:settings', url: '/lightning/setup/SetupOneHome/home' },
        { label: 'Accounts', icon: 'utility:account', url: '/lightning/setup/OrgHealth/home' },
        { label: 'Setup > Users', icon: 'utility:user_role', url: '/lightning/setup/OrgLimits/home' },
        { label: 'Setup > Audit Trail', icon: 'utility:asset_audit', url: '/lightning/setup/OrgHealth/home' },
    ]

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

    // Properties to control the icon and label based on state
    get iconName() {
        return this.isContentVisible ? 'utility:chevronup' : 'utility:chevrondown';
    }

    get buttonLabel() {
        return this.isContentVisible ? 'Collapse Details' : 'Expand Details';
    }

    // New getter to apply a class for visibility/height
    get contentClass() {
        return this.isContentVisible ? 'content-visible' : 'content-hidden';
    }

    get orgTypeLabel() {
        return this.orgDetails ? this.orgDetails.OrganizationType : 'Organization';
    }

    get sandboxLabel() {
        if (!this.orgDetails) return '';
        return this.orgDetails.IsSandbox ? 'Sandbox' : 'Production';
    }

    get sandboxBadgeClass() {
        if (!this.orgDetails) return '';
        return this.orgDetails.IsSandbox ? 'slds-theme_warning' : 'slds-theme_success';
    }

    /**
     * Toggles the visibility of the first div's content.
     */
    toggleContent() {
        this.isContentVisible = !this.isContentVisible;
    }
}