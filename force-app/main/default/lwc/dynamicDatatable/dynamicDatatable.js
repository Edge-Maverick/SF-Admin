import { LightningElement, api, track } from 'lwc';

export default class DynamicDatatable extends LightningElement {
    @api title;
    @api data;
    @api columns;
    @api keyField;
    @api theme;
    @api showConfig = false; //controles wheather to display the configuration options like hide/filter/sort etc..

    @track initialColoumns;
    @track visibleColumns;
    @track filteredData;
    @track sortDirection = 'asc';
    @track sortedBy;
    
    @track searchKey;
}