import { LightningElement, wire, track } from 'lwc';
import getOrgLimitStatus from '@salesforce/apex/AdminPulseController.getOrgLimitStatus';

export default class PulseAlertBanner extends LightningElement {
    @track alerts = [];
    @track isVisible = false;

    @wire(getOrgLimitStatus)
    wiredLimits({ error, data }) {
        if (data) {
            this.alerts = data;
            this.isVisible = data.length > 0;
        } else if (error) {
            console.error('Error fetching limits', error);
        }
    }

    get hasAlerts() {
        return this.isVisible && this.alerts.length > 0;
    }

    handleClose() {
        this.isVisible = false;
    }
}
