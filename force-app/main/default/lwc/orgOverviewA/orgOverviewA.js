import { LightningElement, wire } from 'lwc';
import getOrganizationDetails from '@salesforce/apex/OrgOverviewController.getOrganizationDetails';

export default class OrgOverviewA extends LightningElement {
    orgDetails;
    releaseInfo = null;
    error;

    // Sandbox label + class
    get sandboxLabel() {
        return this.orgDetails?.IsSandbox ? 'Sandbox' : 'Production';
    }
    get computedSandboxClass() {
        return this.orgDetails?.IsSandbox ? 'badge-true' : 'badge-false';
    }

    // Load org details → then load Trust API info
    @wire(getOrganizationDetails)
    wiredOrgDetails({ error, data }) {
        if (data) {
            this.orgDetails = data;
            this.fetchReleaseInfo();
        } else if (error) {
            this.error = error;
        }
    }

    /**
     * STEP 1 — Resolve the REAL Salesforce instance
     * Example: USA772S → NA138 (correct runtime instance)
     */
    async resolveActualInstance() {
        try {
            const resp = await fetch('/services/data/v59.0/', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            // Salesforce returns real instance in header
            const rawInstance = resp.headers.get('sfdc-instance'); 
            if (rawInstance) {
                return rawInstance.toUpperCase(); // e.g., NA138, CS201
            }

            console.error('Instance header missing. Using fallback.');
            return null;
        } catch (e) {
            console.error('Instance resolution failed:', e);
            return null;
        }
    }

    /**
     * STEP 2 — Call Trust API with correct instance
     */
    async fetchReleaseInfo() {
        const instanceKey = await this.resolveActualInstance();

        if (!instanceKey) {
            console.warn('No valid instance found.');
            this.releaseInfo = null;
            return;
        }

        const url = `https://api.status.salesforce.com/v1/instances/${instanceKey}/status`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                console.error('Trust API returned error:', response.status);
                this.releaseInfo = null;
                return;
            }

            const data = await response.json();

            // Build LWC-friendly structure
            this.releaseInfo = {
                release: data.releaseVersion || 'Unknown',
                window: data.releaseCycle
                    ? `${data.releaseCycle.startTime} → ${data.releaseCycle.endTime}`
                    : 'Not Published',
                maint:
                    data.maintenance?.length
                        ? `Next Maintenance: ${data.maintenance[0].windowStart}`
                        : null
            };

            console.log('Release Info →', JSON.stringify(this.releaseInfo));

        } catch (err) {
            console.error('Trust API call failed:', err);
            this.releaseInfo = null;
        }
    }
}