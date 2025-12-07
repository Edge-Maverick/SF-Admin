import { LightningElement, api } from 'lwc';
import { getObservablePlotJS } from 'c/lPlotUtils';

export default class LBarPlot extends LightningElement {
    @api title;
    @api subtitle;
    @api iconName;
    @api helpText;

    @api plotData;
    @api dimension = 'label';
    @api measure = 'value';
    @api stackby; // optional stacking key
    @api topn; // optional limit of categories
    @api horizontal = false; // allow horizontal bars
    @api sort = 'none'; // 'asc' | 'desc' | 'none'

    @api extraWidth = 0;

    _plotRendered = false;
    _theme = 'light';

    @api
    set theme(value) {
        if (value && this._theme !== value) {
            this._theme = value;
            if (this._plotRendered) {
                this.initializeplot();
            }
        }
    }
    get theme() {
        return this._theme;
    }

    async renderedCallback() {
        console.log('plot-data:',this.plotData);
        try {
            await getObservablePlotJS(this);
            if (window.Plot) {
                this.initializeplot();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('lBarPlot failed to load plotting libs', e);
        }
    }

    @api
    initializeplot() {
        const plotContainer = this.template.querySelector('div.plot-container');
        if (!plotContainer) return;

        plotContainer.innerHTML = '';

        if (!window.Plot ){
            plotContainer.innerHTML = 'Plot library not found';
            return;
        }
        if( !Array.isArray(this.plotData) || !this.dimension || !this.measure) {
            plotContainer.innerHTML = 'plot-data not available or incorrect dimension or measure';
            console.error('plot-data not available or incorrect dimension or measure', JSON.stringify(this.plotData), this.dimension, this.measure);
            return;
        }

        const Plot = window.Plot;

        // Build bar mark depending on orientation and stacking
        const sortSpec =
            this.sort === 'none'
                ? undefined
                : this.horizontal
                ? { y: 'x', reverse: this.sort === 'desc',}
                : { x: 'y', reverse: this.sort === 'desc',};
                
        if(sortSpec && this.topn) sortSpec.limit = Number(this.topn);

        //73,136,250 | #4988fa : Salesforce Report BLUE
        const grouped = this.horizontal
                  ? Plot.groupY({ x: 'sum' }, { x: this.measure, y: this.dimension, fill: this.stackby || "#4268d0", sort: sortSpec, tip: true })
                  : Plot.groupX({ y: 'sum' }, { y: this.measure, x: this.dimension, fill: this.stackby || "#4268d0", sort: sortSpec, tip: true });

        const barMark2 = this.stackby
            ? this.horizontal
                ? Plot.barX(this.plotData, grouped)
                : Plot.barY(this.plotData, grouped)
            : this.horizontal
            ? Plot.barX(this.plotData, { x: this.measure, y: this.dimension, sort: sortSpec, tip: true })
            : Plot.barY(this.plotData, { y: this.measure, x: this.dimension, sort: sortSpec, tip: true });
        
        const barMark = this.horizontal
            ? Plot.barX(this.plotData, grouped)
            : Plot.barY(this.plotData, grouped);

        const config = {
            width: plotContainer.offsetWidth,
            marks: [
                this.horizontal ? Plot.ruleY([0]) : null, 
                barMark
            ].filter(Boolean),
            //y: this.horizontal ? {} : { grid: true },
            //x: this.horizontal ? { grid: true , type: 'band'} : {type: 'band'},

            // FIX 1: If Horizontal, Y is the Category (Band), otherwise Y is the Value (Linear)
            y: this.horizontal ? { type: 'band', label: null } : { grid: true, type: 'linear' },
            // FIX 2: If Horizontal, X is the Value (Linear), otherwise X is the Category (Band)
            x: this.horizontal ? { grid: true, type: 'linear' } : { type: 'band' },

            color: { legend: !!this.stackby },
            marginLeft: this.horizontal ? 250 : 60,
            marginBottom: this.horizontal ? 40 : 100,
        };
        console.log('config:',JSON.stringify(sortSpec));

        /*
        marks: [
            window.Plot.ruleY([0]),
            this.stackby? window.Plot.barY(
                this.plotData, 
                Plot.groupX(
                    {y: "sum"}, 
                    {   
                        y: this.measure,
                        x: this.dimension, 
                        fill: this.stackby,
                        sort: {x: "y", reverse: true, limit: 5},
                        tip:true
                    }
                ),
            ): null,
        ]
        */

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
}