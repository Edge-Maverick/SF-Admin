import { LightningElement,track, api } from 'lwc';

import getLicenseUtilization from '@salesforce/apex/OrgOverviewController.getLicenseUtilization';

export default class LicenseUtilization extends LightningElement {
    @api theme;
    @track loading = true;

    showTable = true;

    globalKpis;
    userLicenseData;
    psLicenseData;
    featureLicenseData;

    connectedCallback(){
        this.getData();
    }

    getData(){
        this.loading = true;
        getLicenseUtilization().then(result => {
            this.globalKpis = result.globalKpis;
            this.userLicenseData = result.userLicense;
            this.psLicenseData = result.psLicense;
            this.featureLicenseData = result.featureLicense;
            this.loading = false;
        }).catch(error => {
            this.globalKpis = undefined;
            this.userLicenseData = undefined;
            this.psLicenseData = undefined;
            this.featureLicenseData = undefined;
            this.loading = false;
            console.log('Error: ' + error);
        }); 
        this.loading=false;
    }

    handleRefresh(){
        this.getData();
    }

    handleShowHideTable(){
        this.showTable = !this.showTable;
    }
    
    get showButtonVarient(){
        return this.showTable?'brand':'border-filled';
    }


}