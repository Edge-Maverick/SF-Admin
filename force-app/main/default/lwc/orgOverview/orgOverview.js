import { LightningElement, track } from 'lwc';

export default class OrgOverview extends LightningElement {
    @track isContentVisible = true; 

    // Properties to control the icon and label based on state
    get iconName() {
        return this.isContentVisible ? 'utility:chevronup' : 'utility:chevrondown';
    }

    get buttonLabel() {
        return this.isContentVisible ? 'Collapse Content' : 'Expand Content';
    }

    // New getter to apply a class for visibility/height
    get contentClass() {
        return this.isContentVisible ? 'content-visible' : 'content-hidden';
    }

    /**
     * Toggles the visibility of the first div's content.
     */
    toggleContent() {
        this.isContentVisible = !this.isContentVisible;
    }
}