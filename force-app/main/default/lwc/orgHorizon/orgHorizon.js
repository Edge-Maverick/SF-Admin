import { LightningElement,track } from 'lwc';
import hasAdminPermission1 from '@salesforce/userPermission/ViewSetup';
import hasAdminPermission2 from '@salesforce/userPermission/ManageUsers';
import hasAdminPermission3 from '@salesforce/userPermission/CustomizeApplication';
import hasAdminPermission4 from '@salesforce/userPermission/ModifyMetadata';
import hasAdmin101 from '@salesforce/customPermission/Admin101'; // future namespace..

import { getObservablePlotJS } from 'c/lPlotUtils';

import getHomeDetails from '@salesforce/apex/OrgOverviewController.getHomeDetails';

export default class OrgHorizon extends LightningElement {
    @track currentContent = 'org_overview';
    @track updatedCount = 12;

    currentOrgInfo = undefined;
    currentUser = undefined;

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

    get userName(){
        return this.currentUser ? this.currentUser.FirstName : 'Admin';
    }

    copyOrgId(){
        navigator.clipboard.writeText(text)
        .then(() => {
        console.log("Copied!");
        })
        .catch(err => {
        console.error("Clipboard error:", err);
        });
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