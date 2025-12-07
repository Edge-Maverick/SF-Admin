import { LightningElement,track } from 'lwc';
import { ShowToastEvent } from "lightning/platformShowToastEvent";

import getLicenseUtilization from '@salesforce/apex/OrgOverviewController.getLicenseUtilization';

export default class LicenseUtilizationV2 extends LightningElement {
    @track _viewMode = 'no_view';
    _normalize = true;
    @track _lstUserLicenseMetrics;

    connectedCallback(){
        getLicenseUtilization().then(result => {
            this._lstUserLicenseMetrics = result.lstUserLicenseMetrics;
        }).catch(error => {
            this._lstUserLicenseMetrics = undefined
            console.log('Error: ' + error);
        });
    }

    get noViewSelected(){
        return this._viewMode == 'no_view'?'brand':'brand-outline';
    }
    get costViewSelected(){
        return this._viewMode == 'cost_view'?'brand':'brand-outline';
    }
    handleViewSelection(event){
        this._viewMode = event.target.name;
        if(this._viewMode == 'cost_view'){
            this._normalize = false;
            showNotification('Success','Cost View is not available in normalized, updated the chart to unnormalized!','info');
        }
    }

    get isNomaralized(){
        return this._normalize;
    }
    handleNormalizeChange(){
        this._normalize = !this._normalize;
    }

    /*
    @Actual Data : { "activeLicenses": 3,
                    "assignedLicenses": 4,
                    "label": "Salesforce",
                    "totalLicenses": 11,
                    "unitcost": 1}
    */
    get chartData(){
        let data = [];
        if(this._lstUserLicenseMetrics){
            this._lstUserLicenseMetrics.forEach(licence => {
                let unitCost = (this._viewMode=='cost_view')?1:licence.unitcost;
                data.push({
                    label: licence.label,
                    total: this._normalize?100:licence.totalLicenses,
                    assigned: this._normalize?this.getPercent(licence.assignedLicenses,licence.totalLicenses):licence.assignedLicenses*unitCost,
                    active: this._normalize?this.getPercent(licence.activeLicenses,licence.totalLicenses):licence.activeLicenses*unitCost,
                    category: licence.category
                });
            });
            return JSON.stringify(data);
        }
        else{
            return null;
        }
    }
    get tableData(){
        let data = [];
        if(this._lstUserLicenseMetrics){
            this._lstUserLicenseMetrics.forEach(licence => {
                data.push({
                    ...licence,
                    categoryClass: "category-"+licence.category,
                    assignedstring: licence.assignedLicenses+"("+this.getPercent(licence.assignedLicenses,licence.totalLicenses)+")",
                    activestring: licence.activeLicenses+"("+this.getPercent(licence.activeLicenses,licence.totalLicenses)+")",
                });
            });
            return data;
        }
        else{
            return null;
        }
    }

    @track tableColumns = [
            { label: 'License Name', fieldName: 'label' },
            { label: 'Category', fieldName: 'category', type: 'text',
                cellAttributes: { class: { fieldName: 'categoryClass' } } },
            { label: 'Total Licences', fieldName: 'totalLicenses', type: 'number',  },
            { label: 'Assigned', fieldName: 'assignedstring', type: 'text',  },
            { label: 'Active (30d)', fieldName: 'activestring', type: 'text',  },
        ];

    getPercent(used, total){
        if(total == 0) return 0;
        return Math.min(100, Math.max(0, ((used / total) * 100).toFixed(2) ));
    }

    showNotification(titleText, messageText, variant) {
        const evt = new ShowToastEvent({
        title: titleText,
        message: messageText,
        variant: variant,
        });
        this.dispatchEvent(evt);
    }
}