import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getStorageData from '@salesforce/apex/StorageAnalyzerController.getStorageData';

export default class StorageTreemap extends NavigationMixin(LightningElement) {
    @track treemapItems = [];
    @track dataStorage = {};
    @track fileStorage = {};
    @track isLoading = true;
    @track error;

    // Color Palettes
    standardColors = ['#0984e3', '#74b9ff', '#00cec9', '#81ecec', '#00b894']; // Blues/Teals
    customColors = ['#6c5ce7', '#a29bfe', '#fdcb6e', '#e17055', '#d63031'];   // Purples/Oranges

    @wire(getStorageData)
    wiredStorage({ error, data }) {
        if (data) {
            this.isLoading = false;
            this.processData(data);
            this.error = undefined;
        } else if (error) {
            this.isLoading = false;
            this.error = error;
            console.error('Storage Data Error:', error);
        }
    }

    processData(data) {
        this.dataStorage = this.formatStorageMetric(data.dataStorage, 'MB');
        this.fileStorage = this.formatStorageMetric(data.fileStorage, 'MB');

        const rawItems = data.objectStats || [];
        if (rawItems.length === 0) {
            this.treemapItems = [];
            return;
        }

        // Calculate total for percentages
        const totalRecords = rawItems.reduce((acc, item) => acc + item.count, 0);
        
        // Prepare items for squarify
        // We will simple-map them first for Flexbox Masonry approximation
        // A true squarified algorithm is complex for just a few boxes.
        // We'll use a flex-grow strategy with min-width constraints for a "Treemap-ish" feel.
        
        this.treemapItems = rawItems.map((item, index) => {
            const percentage = (item.count / totalRecords) * 100;
            const fontSize = Math.max(0.8, Math.min(2, 0.8 + (percentage / 10))) + 'rem';
            
            // Smart Coloring
            let color;
            if (item.isCustom) {
                 color = this.customColors[index % this.customColors.length];
            } else {
                 color = this.standardColors[index % this.standardColors.length];
            }
            
            return {
                ...item,
                percentage: percentage.toFixed(1),
                formattedCount: new Intl.NumberFormat().format(item.count),
                style: `background-color: ${color}; flex-grow: ${Math.floor(percentage)}; min-width: ${Math.max(100, percentage * 5)}px; font-size: ${fontSize}; animation-delay: ${index * 50}ms; cursor: pointer;`,
                class: 'treemap-item'
            };
        });
    }

    handleItemClick(event) {
        const apiName = event.currentTarget.dataset.name;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: apiName,
                actionName: 'list'
            },
            state: {
                filterName: 'Recent' 
            }
        });
    }

    renderedCallback() {
        const items = this.template.querySelectorAll('[data-style]');
        items.forEach(item => {
            item.style.cssText = item.dataset.style;
        });
    }

    formatStorageMetric(metric, unit) {
        if (!metric) return {};
        // Calculate style string here
        const width = Math.min(100, metric.usage * 100);
        const color = this.getUsageColor(metric.usage);
        
        return {
            ...metric,
            formattedValue: metric.value + ' ' + unit,
            formattedLimit: metric.limit + ' ' + unit,
            formattedUsage: (metric.usage * 100).toFixed(1) + '%',
            variant: metric.usage > 0.9 ? 'error' : (metric.usage > 0.75 ? 'warning' : 'base'),
            style: `width: ${width}%; background-color: ${color}`
        };
    }

    getUsageColor(usage) {
        if (usage > 0.9) return '#d63031'; // Red
        if (usage > 0.75) return '#fdcb6e'; // Orange
        return '#00b894'; // Green
    }
}
