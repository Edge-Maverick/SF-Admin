import { LightningElement,track } from 'lwc';
import hasAdminPermission1 from '@salesforce/userPermission/ViewSetup';
import hasAdminPermission2 from '@salesforce/userPermission/ManageUsers';
import hasAdminPermission3 from '@salesforce/userPermission/CustomizeApplication';
import hasAdminPermission4 from '@salesforce/userPermission/ModifyMetadata';
import hasAdmin101 from '@salesforce/customPermission/Admin101'; // future namespace..

import { getObservablePlotJS,pivotData } from 'c/lPlotUtils';

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

    get userName(){
        return this.currentUser ? this.currentUser.FirstName : 'Admin';
    }

    copyTextAndNotify(event){
        const text = event.detail.value;
        console.log('clipboard: ', text);
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
        return this.currentContent === 'setup_audit';
    }
}