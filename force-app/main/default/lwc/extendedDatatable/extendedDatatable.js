import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Mock Apex import for demonstration. In a real scenario, replace this
// with your actual Apex method to fetch data and metadata.
// import getObjectMetadataAndData from '@salesforce/apex/DynamicTableController.getObjectMetadataAndData';

export default class ExtendedDatatable extends LightningElement {
    // --- Public Properties (API) ---
    @api title = 'Dynamic Data View';
    @api objectName; // Used for Apex data fetching/metadata lookup
    @api keyField = 'Id';
    @api records; // Initial data if passed in (overrides Apex fetch)
    @api theme = 'none'; // Accepts: 'red', 'green', 'orange', 'blue', or '#hexcode'
    
    // --- Internal State (Tracked) ---
    @api initialColumns = []; // Columns initially provided or inferred
    @track visibleColumns = []; // Columns currently shown in the table
    @track data = []; // The raw, immutable data set
    @track filteredData = []; // Data shown after local search filter
    @track searchKey = '';
    
    // --- Lifecycle Hooks ---
    connectedCallback() {
        if (this.records && this.records.length > 0) {
            this.data = JSON.parse(JSON.stringify(this.records));
            // Start the initialization process with provided data
            this.initializeTable();
        } else if (this.objectName) {
            // --- SIMULATED APEX CALL ---
            // In a real component, you would call Apex here to fetch metadata and data:
            // this.fetchDataFromApex(this.objectName);
            
            // --- Mock Data for Example ---
            this.data = this.getMockData();
            this.initializeTable();
        } else {
            console.error('DynamicDatatable requires either "records" or "objectName".');
            this.showToast('Error', 'Missing required data source.', 'error');
        }
    }

    // --- Mock Data and Apex Simulation ---
    getMockData() {
        return [
            { Id: 'a01', Name: 'Acme Corp', Type: 'Customer', Rating: 'Hot', AnnualRevenue: 1000000, Notes: null, CreatedDate: '2023-10-15T10:00:00Z' },
            { Id: 'a02', Name: 'Global Solutions', Type: 'Partner', Rating: 'Warm', AnnualRevenue: 550000, Notes: '', CreatedDate: '2023-11-20T12:30:00Z' },
            { Id: 'a03', Name: 'Tech Innovators', Type: 'Customer', Rating: 'Cold', AnnualRevenue: 120000, Notes: 'Follow up Q2', CreatedDate: '2024-01-05T08:00:00Z' },
            { Id: 'a04', Name: 'Best Services Inc', Type: 'Prospect', Rating: 'Hot', AnnualRevenue: 800000, Notes: 'High priority', CreatedDate: '2024-02-01T15:45:00Z' },
            { Id: 'a05', Name: 'Zeta Consulting', Type: 'Customer', Rating: 'Warm', AnnualRevenue: 20000, Notes: 'Low engagement', CreatedDate: '2024-03-10T11:00:00Z' },
        ];
    }
    
    // async fetchDataFromApex(objectName) {
    //     try {
    //         const result = await getObjectMetadataAndData({ objectName });
    //         this.data = result.data;
    //         this.initialColumns = result.columns; // Assuming Apex provides structured columns
    //         this.initializeTable();
    //     } catch (error) {
    //         this.showToast('Error fetching data', error.body.message, 'error');
    //         console.error(error);
    //     }
    // }

    // --- Core Initialization Logic ---
    initializeTable() {
        // 1. Infer columns if none were provided (either from @api or Apex)
        if (this.initialColumns.length === 0 && this.data.length > 0) {
            this.initialColumns = this.inferColumnTypes(this.data);
        }
        
        // 2. Hide columns that contain no data in any row
        this.visibleColumns = this.autoHideEmptyColumns(this.initialColumns, this.data);
        
        // 3. Apply initial filter (or none) and refresh the data view
        this.applyFilterAndSort();
    }

    // --- Column Type Inference (JS Fallback) ---
    inferColumnTypes(records) {
        if (!records || records.length === 0) return [];
        
        const firstRecord = records[0];
        const inferredCols = [];
        
        for (const field in firstRecord) {
            if (Object.prototype.hasOwnProperty.call(firstRecord, field)) {
                const sampleValue = firstRecord[field];
                let type = 'text'; // Default type
                let label = field.replace(/([A-Z])/g, ' $1').trim(); // Convert 'AnnualRevenue' to 'Annual Revenue'

                // Simple type detection based on the first record's value
                if (typeof sampleValue === 'number') {
                    type = 'number';
                    if (label.toLowerCase().includes('revenue') || label.toLowerCase().includes('amount')) {
                        type = 'currency';
                    }
                } else if (typeof sampleValue === 'boolean') {
                    type = 'boolean';
                } else if (sampleValue && String(sampleValue).match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                    // Simple regex for ISO date strings
                    type = 'date';
                } else if (field.toLowerCase().includes('url')) {
                    type = 'url';
                }

                inferredCols.push({
                    label: label,
                    fieldName: field,
                    type: type,
                    sortable: true,
                    hidden: false // Initial state
                });
            }
        }
        return inferredCols;
    }

    // --- Dynamic Column Hiding Logic ---
    autoHideEmptyColumns(columns, records) {
        const columnsToKeep = [];
        
        for (const col of columns) {
            const field = col.fieldName;
            let hasData = false;

            // Check if ANY record has a non-empty, non-null value for this field
            for (const record of records) {
                const value = record[field];
                // Check for value is not null, not undefined, and not an empty string
                if (value !== null && value !== undefined && String(value).trim() !== '') {
                    hasData = true;
                    break; 
                }
            }
            
            // Only add column if it has data
            if (hasData) {
                columnsToKeep.push(col);
            } else {
                // If it's hidden, mark it so the user can unhide it later
                col.hidden = true; 
            }
        }
        
        // Store all columns (including hidden ones) for the column picker
        this.initialColumns = columns;
        return columnsToKeep;
    }

    // --- Search / Filtering Logic ---
    handleSearch(event) {
        this.searchKey = event.target.value.toLowerCase();
        this.applyFilterAndSort();
    }

    applyFilterAndSort() {
        let currentData = [...this.data];

        // 1. Apply Filtering
        if (this.searchKey) {
            currentData = currentData.filter(record => {
                // Search across all visible fields (by label or fieldName)
                return this.visibleColumns.some(col => {
                    const value = record[col.fieldName];
                    return value !== null && String(value).toLowerCase().includes(this.searchKey);
                });
            });
        }

        // 2. Apply Sorting (if a sort state exists)
        if (this.sortedBy && this.sortDirection) {
            this.sortData(this.sortedBy, this.sortDirection, currentData);
        }
        
        this.filteredData = currentData;
    }

    // --- Sorting Logic ---
    sortedBy;
    sortDirection = 'asc';

    handleSort(event) {
        const { fieldName: sortedBy, sortDirection } = event.detail;
        const currentData = [...this.filteredData]; // Sort the already filtered data

        this.sortData(sortedBy, sortDirection, currentData);

        this.sortedBy = sortedBy;
        this.sortDirection = sortDirection;
        this.filteredData = currentData;
    }

    sortData(fieldName, direction, data) {
        const parse = val => (isNaN(val) ? val : parseFloat(val));
        const reverse = direction === 'asc' ? 1 : -1;

        data.sort((a, b) => {
            let valueA = parse(a[fieldName]);
            let valueB = parse(b[fieldName]);

            // Handle nulls/undefined gracefully
            valueA = valueA === null || valueA === undefined ? '' : valueA;
            valueB = valueB === null || valueB === undefined ? '' : valueB;

            // Case-insensitive string comparison
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            if (valueA < valueB) {
                return reverse * -1;
            } else if (valueA > valueB) {
                return reverse * 1;
            }
            return 0;
        });
    }

    // --- Column Visibility Management ---
    get columnOptions() {
        return this.initialColumns.map(col => ({
            label: col.label,
            value: col.fieldName,
            checked: !col.hidden // Determine check status from the hidden property
        }));
    }

    handleColumnChange(event) {
        const selectedFields = event.detail.value;

        const newVisibleColumns = [];
        this.initialColumns = this.initialColumns.map(col => {
            const isVisible = selectedFields.includes(col.fieldName);
            col.hidden = !isVisible;
            if (isVisible) {
                newVisibleColumns.push(col);
            }
            return col;
        });
        
        this.visibleColumns = newVisibleColumns;
        // Re-apply filter/sort just in case the key field was hidden/unhidden
        this.applyFilterAndSort();
    }
    
    // --- Computed Properties for Header ---
    get totalCount() {
        return this.data.length;
    }

    get filteredCount() {
        return this.filteredData.length;
    }

    get countDisplay() {
        return `Showing ${this.filteredCount} of ${this.totalCount} records`;
    }

    get themeClass() {
        // Apply predefined Tailwind-like colors or custom hex color via inline style
        switch (this.theme.toLowerCase()) {
            case 'red':
                return 'border-red-500 bg-red-50';
            case 'green':
                return 'border-green-500 bg-green-50';
            case 'orange':
                return 'border-orange-500 bg-orange-50';
            case 'blue':
                return 'border-blue-500 bg-blue-50';
            case 'none':
            default:
                return 'border-gray-300 bg-white';
        }
    }

    get customThemeStyle() {
        // Check if theme is a hex code
        if (this.theme.startsWith('#')) {
            // Apply custom border and background color
            return `border-color: ${this.theme}; background-color: ${this.theme}10;`; // Hex10 for 10% opacity
        }
        return '';
    }

    // --- Utility ---
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }
}