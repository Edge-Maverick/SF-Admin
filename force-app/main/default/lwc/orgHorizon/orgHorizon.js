import { LightningElement, track, wire } from 'lwc';
import hasAdminPermission1 from '@salesforce/userPermission/ViewSetup';
import hasAdminPermission2 from '@salesforce/userPermission/ManageUsers';
import hasAdminPermission3 from '@salesforce/userPermission/CustomizeApplication';
import hasAdminPermission4 from '@salesforce/userPermission/ModifyMetadata';
import hasAdmin101 from '@salesforce/customPermission/Admin101'; // future namespace..

import { getObservablePlotJS } from 'c/lPlotUtils';

import getHomeDetails from '@salesforce/apex/OrgOverviewController.getHomeDetails';
import getTrustInfo from '@salesforce/apex/OrgOverviewController.getTrustInfo';
import getUpcomingRelease from '@salesforce/apex/OrgOverviewController.getUpcomingRelease';

export default class OrgHorizon extends LightningElement {
    @track currentContent = 'org_overview';
    @track updatedCount = 12;
    @track isFlipped = false;
    @track trustInfo;
    @track releaseInfo;

    currentOrgInfo = undefined;
    currentUser = undefined;

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

    get hasActiveIncidents() {
        return this.trustInfo && this.trustInfo.activeIncidents && this.trustInfo.activeIncidents.length > 0;
    }

    get apiVersion() {
        return this.trustInfo ? this.trustInfo.apiLevel : '-';
    }

    get currentReleaseVersion() {
        // Example: "Winter '25 Patch 11.4" -> "Winter '25"
        if (this.trustInfo && this.trustInfo.releaseVersion) {
            return this.trustInfo.releaseVersion.split(' Patch')[0];
        }
        return '';
    }

    get nextReleaseDays() {
        return this.releaseInfo ? this.releaseInfo.daysRemaining : null;
    }

    get nextReleaseName() {
        return this.releaseInfo ? this.releaseInfo.name.replace(' Major Release', '') : '';
    }

    get pulseClass() {
        if (this.hasActiveIncidents) {
            return 'status-pulse error';
        }
        return `status-pulse ${this.isProduction ? 'production' : 'sandbox'}`;
    }

    get hasAllAdminPermission() {
        return (
            hasAdminPermission1 &&
            hasAdminPermission2 &&
            hasAdminPermission3 &&
            hasAdminPermission4 &&
            hasAdmin101
        );
    }

    async connectedCallback(){
        try {
            await getObservablePlotJS(this);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to load Plot/D3 libraries', e);
        }
        getHomeDetails().then(result => {
            this.currentOrgInfo = result.currentOrgInfo;
            this.currentUser = result.currentUser;
            console.log('currentOrgInfo>',JSON.stringify(this.currentOrgInfo));
            console.log('currentUserInfo>',JSON.stringify(this.currentUser));
        }).catch(error => {
            this.currentOrgInfo = undefined;
            this.currentUser = undefined
            console.log('error',error);
        });
    }

    get isProduction(){
        return true;
        //return (this.currentOrgInfo && this.currentOrgInfo.IsSandbox === false); //TODO: to remove the initial true value. added for building..
    }
    get maskedOrgId(){
        return this.currentOrgInfo ? '00D'+this.currentOrgInfo.Id.replace(/^.{11}/,'...') : '.....';
    }

    get orgId(){
        return this.currentOrgInfo ? this.currentOrgInfo.Id : '';
    }

    get cardClass() {
        return `mini-id-card slds-var-m-vertical_x-small ${this.isProduction ? 'production' : 'sandbox'}`;
    }

    get userPhotoUrl() {
        return this.currentUser ? this.currentUser.SmallPhotoUrl : '';
    }

    get orgCreatedYear() {
        return this.currentOrgInfo && this.currentOrgInfo.CreatedDate ? new Date(this.currentOrgInfo.CreatedDate).getFullYear() : '2025';
    }

    get userName(){
        return this.currentUser ? this.currentUser.FirstName : 'Admin';
    }

    copyOrgId(event){
        event.stopPropagation(); // Prevent card flip on copy
        const text = this.orgId;
        if(text){
             navigator.clipboard.writeText(text)
            .then(() => {
                // console.log("Copied!");
                // Show a toast or small feedback if needed
            })
            .catch(err => {
                console.error("Clipboard error:", err);
            });
        }
    }

    handleCardClick() {
        this.isFlipped = !this.isFlipped;
    }

    get innerClass() {
        return `card-inner ${this.isFlipped ? 'flipped' : ''}`;
    }

    handleSelect(event) {
        const selected = event.detail.name;

        if (selected === 'reports_updated') {
            this.updatedCount = 0;
        }

        this.currentContent = selected;
    }

    get showOrgOverview(){
        return this.currentContent === 'org_overview';
    }
    get showLicenceUtilization(){
        return this.currentContent === 'licence_utilization';
    }
    get showSetupAuditTrail(){
        return this.currentContent === 'setup_audit_trail';
    }
    get showTechincalHealth(){
        return this.currentContent === 'techincal_health';
    }
}