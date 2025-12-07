import { LightningElement,track } from 'lwc';

import { pivotData } from 'c/lPlotUtils';

import getLicenceUtilization from '@salesforce/apex/OrgOverviewController.getLicenceUtilization';

export default class LicenseUtilization extends LightningElement {
    @track licenceUtilizationData;
    @track licenceUtilizationPS;
    @track dormantUsers;

    @track licenceMetricsPS;
    @track licenceMetricsFeature;

    connectedCallback(){
        getLicenceUtilization().then(result => {
            this.licenceUtilizationData = result.lstLicenceUsage;
            this.licenceUtilizationPS = result.lstPSLicenceUsage;
            this.dormantUsers = result.dormantUsers;
            this.licenceMetricsPS = result.lstPSMetricUsage;
            this.licenceMetricsFeature = result.lstFeatureMetricUsage;
        }).catch(error => {
            this.licenceUtilizationData = undefined;
            this.licenceUtilizationPS = undefined;
            this.dormantUsers = undefined;
            this.licenceMetricsPS = undefined;
            this.licenceMetricsFeature = undefined;
            console.log('Error: ' + error);
        });
    }

    get temp(){
        return JSON.stringify(this.licenceUtilizationPS);
    }

    get totalUserLicence(){
        let totalPurchasedLicences = 0;
        let totalUsedLicences = 0;
        let totalRemaingLicences = 0;
        if(this.licenceUtilizationData){
            this.licenceUtilizationData.forEach(licence => {
                totalPurchasedLicences += licence.totalLicenses;
                totalUsedLicences += licence.usedLicenses;
                totalRemaingLicences +=   ( licence.totalLicenses - licence.usedLicenses) ;
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
        let count = 0;
        if(this.licenceUtilizationData){
            this.licenceUtilizationData.forEach(licence => {
                if(!licence.isCritical) return; //filtering out the non critical licences..
                totalPurchasedLicences += licence.totalLicenses;
                totalUsedLicences += licence.usedLicenses;
                totalRemaingLicences +=   ( licence.totalLicenses - licence.usedLicenses) ;
                count++;
            });
        }

        return {
            totalValue: totalPurchasedLicences,
            usedValue: totalUsedLicences,
            remainingValue: totalRemaingLicences,
            percent: (totalUsedLicences/totalPurchasedLicences)*100,
            count: count
        };
    }
    get criticalUL(){
        var strCriticalUL = '';
        if(this.licenceUtilizationData){
            this.licenceUtilizationData.forEach(licence => {
                if(!licence.isCritical) return;
                strCriticalUL += licence.label + ' | ';
            });
        }
        else{
            strCriticalUL = 'No Critical Licences Found ';
        }
        return strCriticalUL + '(Use Settings to Set Critical Licences)';
    }
    get dormatUserForamt(){
        return this.dormantUsers > 5 ? "red" :( this.dormantUsers > 0? "neutral":"green");
    }

    /* PERMISSION SET LICENCE UTILIZATION */
    get totalPSLicence(){
        let totalPurchasedLicences = 0;
        let totalUsedLicences = 0;
        let totalRemaingLicences = 0;
        if(this.licenceUtilizationPS){
            this.licenceUtilizationPS.forEach(licence => {
                totalPurchasedLicences += licence.totalLicenses;
                totalUsedLicences += licence.usedLicenses;
                totalRemaingLicences +=   ( licence.totalLicenses - licence.usedLicenses) ;
            });
        }

        return {
            totalValue: totalPurchasedLicences,
            usedValue: totalUsedLicences,
            remainingValue: totalRemaingLicences,
            percent: (totalUsedLicences/totalPurchasedLicences)*100
        };
    }
    get totalPSLicenceCritical(){
        let totalPurchasedLicences = 0;
        let totalUsedLicences = 0;
        let totalRemaingLicences = 0;
        let count = 0;
        if(this.licenceUtilizationPS){
            this.licenceUtilizationPS.forEach(licence => {
                if(!licence.isCritical) return; //filtering out the non critical licences..
                totalPurchasedLicences += licence.totalLicenses;
                totalUsedLicences += licence.usedLicenses;
                totalRemaingLicences +=   ( licence.totalLicenses - licence.usedLicenses) ;
                count++;
            });
        }

        return {
            totalValue: totalPurchasedLicences,
            usedValue: totalUsedLicences,
            remainingValue: totalRemaingLicences,
            percent: (totalUsedLicences/totalPurchasedLicences)*100,
            count: count
        };
    }

    get psMetric(){
        if(!this.licenceUtilizationPSMetric) return [];
        return pivotData(this.licenceUtilizationPSMetric,['TotalLicenses','AssignedUserCount','ActiveUserCount'],'type','value');
    }

}