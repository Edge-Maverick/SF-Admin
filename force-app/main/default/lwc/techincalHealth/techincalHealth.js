import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getOrgHealthStats from '@salesforce/apex/TechnicalHealthController.getOrgHealthStats';
import getHealthDetails from '@salesforce/apex/TechnicalHealthController.getHealthDetails';

const COLUMNS = [
    { label: 'Name', fieldName: 'recordUrl', type: 'url', typeAttributes: { label: { fieldName: 'name' }, target: '_blank' } },
    { label: 'Metadata Type', fieldName: 'type', type: 'text', initialWidth: 130 },
    { label: 'Details', fieldName: 'extraInfo', type: 'text' }
];

export default class TechnicalHealth extends LightningElement {
    
    @track stats = {};
    @track tableData = [];
    @track selectedMetricTitle = 'Select a Metric';
    
    columns = COLUMNS;
    wiredStatsResult;
    isLoading = true;
    isTableLoading = false;

    @wire(getOrgHealthStats)
    wiredData(result) {
        this.wiredStatsResult = result;
        const { data, error } = result;
        if (data) {
            this.stats = data;
            this.isLoading = false;
        } else if (error) {
            console.error(error);
            this.isLoading = false;
        }
    }

    refreshStats() {
        this.isLoading = true;
        refreshApex(this.wiredStatsResult);
    }

    handleCardClick(event) {
        const metricType = event.currentTarget.dataset.id;
        this.updateTitle(metricType);
        this.fetchDetails(metricType);
    }

    updateTitle(type) {
        const titles = {
            'OUTDATED': 'Outdated Components (< v64.0)',
            'MULTIPLE_TRIGGERS': 'Objects with Multiple Triggers',
            'ASYNC_ERRORS': 'Async Job Failures (24h)',
            'INACTIVE_FLOWS': 'Inactive Flows',
            'FAILED_INTERVIEWS': 'Paused/Failed Flow Interviews',
            'PROCESS_BUILDERS': 'Legacy Active Process Builders',
            'STALE_USERS': 'Stale Users (Inactive > 90 Days)',
            'FROZEN_USERS': 'Frozen Users',
            'LICENSE_USAGE': 'Salesforce License Usage',
            'EXPIRED_CERTS': 'Expired Certificates',
            'ORG_LIMITS': 'Organization Limits (Storage & API)'
        };
        this.selectedMetricTitle = titles[type] || 'Details';
    }

    fetchDetails(metricType) {
        this.isTableLoading = true;
        this.tableData = null;

        getHealthDetails({ metricType: metricType })
            .then(result => {
                this.tableData = result;
                this.isTableLoading = false;
            })
            .catch(error => {
                console.error('Error fetching details', error);
                this.isTableLoading = false;
            });
    }
}