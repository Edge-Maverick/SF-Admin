import { LightningElement,track } from 'lwc';

export default class OrgHorizon extends LightningElement {
    @track selectedItem = 'org_overview';
    @track currentContent = 'org_overview';
    @track updatedCount = 12;

    handleSelect(event) {
        const selected = event.detail.name;

        if (selected === 'reports_updated') {
            this.updatedCount = 0;
        }

        this.currentContent = selected;
    }
}