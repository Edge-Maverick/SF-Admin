import { LightningElement,track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import hasAdminPermission1 from '@salesforce/userPermission/ViewSetup';
import hasAdminPermission2 from '@salesforce/userPermission/ManageUsers';
import hasAdminPermission3 from '@salesforce/userPermission/CustomizeApplication';
import hasAdminPermission4 from '@salesforce/userPermission/ModifyMetadata';
import hasAdmin101 from '@salesforce/customPermission/Admin101'; // future namespace..

import { getObservablePlotJS } from 'c/lPlotUtils';

const THEMES = [
    {label: 'Light', name: 'light', color: '#74a37eff', fontFamily: 'Arial', fontStyle: 'normal'},
    {label: 'Dark', name: 'dark', color: '#000000', fontFamily: 'Arial', fontStyle: 'italic'},
]; 
// TODO : theme adding using the above method is a success, needs to be improved at the end. reference from (https://lwc.dev/guide/css#create-styling-hooks)

import getHomeDetails from '@salesforce/apex/OrgOverviewController.getHomeDetails';

export default class OrgHorizon extends LightningElement {
    @track currentContent = 'org_overview'; //TODO : fetch from URL parameters
    @track updatedCount = 12;

    currentOrgInfo = undefined;
    currentUser = undefined;

    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        this.pageRef = pageRef;
        if (pageRef && pageRef.state && pageRef.state.c__section) {
            this.currentContent = pageRef.state.c__section;
        }
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

    //THEME Is selected by the user from the UI
    @track theme = 0;
    get customThemeStyling() {
        const customtheme = THEMES[this.theme];
        return `
            --color: ${customtheme.color}; 
            --font-family: ${customtheme.fontFamily}; 
            --font-style: ${customtheme.fontStyle};
        `;
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
    get showLoginForensics(){
        return this.currentContent === 'login_forensics';
    }
    get showTechincalHealth(){
        return this.currentContent === 'techincal_health';
    }

    get showCommandConsole(){
        return this.currentContent === 'command_console';
    }
}