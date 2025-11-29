import { LightningElement, api } from 'lwc';

export default class LPlotContainer extends LightningElement {
    @api theme='batman';
    @api title;
    @api subtitle;
    @api iconName;
    @api helpText;

    get themeClass() {
        return 'slds-m-around_xx-small plot-card theme-' + this.theme;
    }
}