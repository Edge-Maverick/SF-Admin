import { LightningElement,track } from 'lwc';

import getLicenceUtilization from '@salesforce/apex/OrgOverviewController.getLicenceUtilization';

export default class LicenseUtilization extends LightningElement {
    @track licenceUtilizationData;
    lstCriticalUL = [];
    @track dormantUsers;

    connectedCallback(){
        getLicenceUtilization().then(result => {
            this.licenceUtilizationData = result.lstLicenceUsage;
            this.lstCriticalUL = result.lstCriticalLicences;
            this.dormantUsers = result.dormantUsers;

        }).catch(error => {
            this.licenceUtilizationData = undefined;
            this.lstCriticalUL = undefined;
            this.dormantUsers = undefined;
            console.log('Error: ' + error);
        });
    }

    get totalUserLicence(){
        let totalPurchasedLicences = 0;
        let totalUsedLicences = 0;
        let totalRemaingLicences = 0;
        if(this.licenceUtilizationData){
            this.licenceUtilizationData.forEach(licence => {
                totalPurchasedLicences += licence.TotalLicenses;
                totalUsedLicences += licence.UsedLicenses;
                totalRemaingLicences +=   ( licence.TotalLicenses - licence.UsedLicenses) ;
            });
        }

        return {
            totalValue: totalPurchasedLicences,
            usedValue: totalUsedLicences,
            remainingValue: totalRemaingLicences,
            percent: (totalUsedLicences/totalPurchasedLicences)*100
        };
    }

    get totalUserLicenceCritical(){
        let totalPurchasedLicences = 0;
        let totalUsedLicences = 0;
        let totalRemaingLicences = 0;
        if(this.licenceUtilizationData){
            this.licenceUtilizationData.forEach(licence => {
                if(!this.lstCriticalUL.includes(licence.Label)) return; //filtering out the non critical licences..
                totalPurchasedLicences += licence.TotalLicenses;
                totalUsedLicences += licence.UsedLicenses;
                totalRemaingLicences +=   ( licence.TotalLicenses - licence.UsedLicenses) ;
            });
        }

        return {
            totalValue: totalPurchasedLicences,
            usedValue: totalUsedLicences,
            remainingValue: totalRemaingLicences,
            percent: (totalUsedLicences/totalPurchasedLicences)*100
        };
    }
    get dormatUserForamt(){
        return this.dormantUsers > 5 ? "red" :( this.dormantUsers > 0? "neutral":"green");
    }
}