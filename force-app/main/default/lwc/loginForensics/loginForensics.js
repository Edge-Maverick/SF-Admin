import { LightningElement, track } from 'lwc';
import { getObservablePlotJS } from 'c/lPlotUtils';

import getLoginTreeData from '@salesforce/apex/LoginForensicsHelper.getLoginTreeData';
import getLoginConfig from '@salesforce/apex/LoginForensicsHelper.getLoginConfig';

export default class LoginForensics extends LightningElement {
    @track prepData;
    @track configData;
    configDataError; 
    configDataLoading = false;

    connectedCallback(){
        getLoginTreeData().then((response) => {
            this.prepData = response;
            
            console.log('data', JSON.stringify(response));
        }).catch((error) => {
            console.log('error', error);
        });
    }
    async renderedCallback(){
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

    initializeplot(){
        console.log('renderedCallback');
        // use the observable plot.js / d3.js to draw a chart/...
        const plotContainer = this.template.querySelector('div.plot-container-ul');
        if (!plotContainer) return;

        plotContainer.innerHTML = '';

        if (!window.Plot){
            plotContainer.innerHTML = 'Plot library not found';
            return;
        }
        const chartData = this.prepData;
        if( !Array.isArray(chartData) ) {
            plotContainer.innerHTML = 'plot data not available';
            console.error('plot data not available', JSON.stringify(chartData));
            return;
        }
        console.log('renderedCallback1');

        const width= plotContainer.clientWidth;
        const height = plotContainer.clientHeight;

        const Plot = window.Plot;

        const config = {
            style: {
                fontSize: "12px"
            },
            axis:null,
            width: width,
            margin: 10,
            marginRight : 100,
            marks: [
                Plot.tree(chartData, {path: "path", delimiter: "/", strokeOpacity: 1}),
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
            console.error('Error rendering bar plot',  e?.message,e?.stack);
            plotContainer.innerHTML = 'Error rendering bar chart.';
        }
        console.log('renderedCallback2');
    }


    handleFetchConfig(){
        this.configDataLoading=true;
         getLoginConfig().then((response) => {
            this.configData = response;
            this.configDataLoading=false;
            this.configDataError = undefined;
            console.log('data', JSON.stringify(response));
        }).catch((e) => {
            this.configDataLoading=false;
            this.configDataError = e?.message;
            console.log('error', e?.message,e?.stack);
        });
    }
}