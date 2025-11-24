import { LightningElement, track, wire } from 'lwc';
import getOrganizationDetails from '@salesforce/apex/OrgOverviewController.getOrganizationDetails';
import getUpcomingRelease from '@salesforce/apex/OrgOverviewController.getUpcomingRelease';

export default class OrgOverview extends LightningElement {
    @track isContentVisible = true; 
    @track orgDetails;
    @track releaseInfo;
    @track error;

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
        return this.isContentVisible ? 'Collapse Content' : 'Expand Content';
    }

    // New getter to apply a class for visibility/height
    get contentClass() {
        return this.isContentVisible ? 'content-visible' : 'content-hidden';
    }

    /**
     * Toggles the visibility of the first div's content.
     */
    toggleContent() {
        this.isContentVisible = !this.isContentVisible;
    }
}