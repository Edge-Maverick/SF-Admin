import { LightningElement, track, api } from 'lwc';
import { getObservablePlotJS } from 'c/lPlotUtils';

const VIEW_MODES = [
   {label:'Count View', name:'count_view'},
   {label:'Cost View', name:'cost_view'}
];

const TABLE_COLUMNS = [
    { label: 'License Name', fieldName: 'label' , hideDefaultActions: true,wrapText:true,
        fixedWidth: 250, editable:false
    },
    { label: 'Category', fieldName: 'category', type: 'text',hideDefaultActions: true,
        cellAttributes: { alignment: 'left', class: "slds-text-title"} },
    { label: 'Unit Cost', fieldName: 'unitcost', type: 'number',hideDefaultActions: true },
    { label: 'Total Licenses', fieldName: 'totalLicenses', type: 'number',hideDefaultActions: true  },
    { label: 'Assigned', fieldName: 'assignedstring', type: 'text', hideDefaultActions: true },
    { label: 'Remaining', fieldName: 'availableLicenses', type: 'text', hideDefaultActions: true,
        cellAttributes: { alignment: 'center', class: "slds-text-color_default slds-theme_info"}
     },
    { label: 'Active (30d)', fieldName: 'activestring', type: 'text', hideDefaultActions: true,
        cellAttributes: { alignment: 'center', class: "slds-text-color_default slds-theme_success"}
    },
    { label: 'Dormant', fieldName: 'dormantLicenses', type: 'text', hideDefaultActions: true,
        cellAttributes: { alignment: 'center', class: "slds-text-color_default slds-theme_warning"}
    },
    { label: 'Findings?', fieldName: 'findings', type: 'text', hideDefaultActions: true,
        cellAttributes: { alignment: 'left', class: "slds-text-color_default"}, fixedWidth: 250
    },
];

export default class LicenseUtilizationHelper extends LightningElement {
    @track _lstMetrics = [];
    @track lstCategories = [];

    @api showTable;

    selectedCategory = 'all';
    //filteredData = [];

    selectedMode = VIEW_MODES[0].name;
    normalize = true; //uses percentage to draw the chart

    @api
    set wrapperData(value){
        value.lstMetrics.forEach(license => {
            this._lstMetrics.push({
                ...license,

                totalPercent: 100,
                assignedPercent: this.getPercent(license.assignedLicenses,license.totalLicenses),
                activePercent: this.getPercent(license.activeLicenses,license.totalLicenses),
                availablePercent: this.getPercent(license.availableLicenses,license.totalLicenses),
                dormantPercent: this.getPercent(license.dormantLicenses,license.totalLicenses),
                

                categoryClass: "category-"+license.category,
            });
        });
        console.log('wrapper called');
        this.lstCategories = value.lstCategories;
        //this.filterData();
    }
    get wrapperData(){
        return null;
    }

    async renderedCallback() {
        try {
            await getObservablePlotJS(this);
            if (window.Plot) {
                this.initializeplot();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('plot failed to load plotting libs', e?.message,e?.stack);
        }
    }

    handleCategorySelect(event){
        this.selectedCategory = event.target.value;
        //this.filterData();
    }

    get filteredData(){
        if(this._lstMetrics){
            if (this.selectedCategory==='all') return this._lstMetrics;
            return this._lstMetrics.filter(license => {
                return (license.category && new String(license.category).includes(this.selectedCategory));
            });
        }
        else{
            return null;
        }
    }

    handleModeSelect(event){
        this.selectedMode = event.target.value;
    }

    get tableColumns(){
        return TABLE_COLUMNS;
    }

    get prepData(){
        let data = [];
        if( this.filteredData){
            this.filteredData.forEach(license => {
                var unitprice = (this.selectedMode=='cost_view')?license.unitcost:1;
                data.push({
                    ...license,
                    total: this.normalize?100:license.totalLicenses*unitprice,
                    assigned: this.normalize?license.assignedPercent:license.assignedLicenses*unitprice,
                    active: this.normalize?license.activePercent:license.activeLicenses*unitprice,

                    categoryClass: "category-"+license.category,
                    totalstring: license.totalLicenses,
                    assignedstring: license.assignedLicenses+" ("+license.assignedPercent+"%)",
                    activestring: license.activeLicenses+" ("+license.activePercent+"%)",
                });
            });
            return data;
        }
        return null;
    }

    initializeplot(){
        // use the observable plot.js / d3.js to draw a chart/...
        const plotContainer = this.template.querySelector('div.plot-container-ul');
        if (!plotContainer) return;

        plotContainer.innerHTML = '';

        if (!window.Plot ){
            plotContainer.innerHTML = 'Plot library not found';
            return;
        }
        const chartData = this.prepData;
        if( !Array.isArray(chartData) ) {
            plotContainer.innerHTML = 'plot data not available';
            console.error('plot data not available', JSON.stringify(chartData));
            return;
        }

        const width= plotContainer.clientWidth;
        const height = plotContainer.clientHeight;

        const Plot = window.Plot;

        const config = {
            style: {
                fontSize: "12px"
            },
            width: width,
            margin: 20,
            marginLeft : 250,
            marginBottom : 30,
            marks: [
                Plot.barX(chartData, {x: "total", y: "label", fill:"#747474", tip:true, 
                    title: (d)=>`${d.label}\ntotal:${d.totalLicenses}\nassigned:${d.assignedstring}\nremaining:${d.availableLicenses}\n-----\nactive users:${d.activestring}\ndormant users:${d.dormantLicenses}`
                 }, ),
                Plot.barX(chartData, {x: "assigned", y: "label", fill:"#dd7a01", tip:false}, ),
                Plot.barX(chartData, {x: "active", y: "label", fill:"green", tip:false}, ),
                Plot.ruleX([0])
            ]
        };

        try {
            const barPlot = Plot.plot(config);
            if (barPlot) {
                plotContainer.appendChild(barPlot);
                this._plotRendered = true;
            } else {
                plotContainer.innerHTML = 'Unable to render chart.';
                this._plotRendered = true;
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Error rendering bar plot', e);
            plotContainer.innerHTML = 'Error rendering bar chart.';
        }
    }

    getPercent(used, total){
        if(total == 0) return 0;
        return Math.min(100, Math.max(0, ((used / total) * 100).toFixed(2) ));
    }
}