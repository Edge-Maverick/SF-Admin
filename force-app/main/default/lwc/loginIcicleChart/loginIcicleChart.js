import { LightningElement, wire, api } from 'lwc';
import getLoginTreeData from '@salesforce/apex/LoginForensicsHelper.getLoginTreeData';

import { getObservablePlotJS } from 'c/lPlotUtils';

export default class LoginIcicleChart extends LightningElement {
    d3Initialized = false;
    @api chartData;

    /*@wire(getLoginTreeData)
    wiredData({ error, data }) {
        if (data) {
            this.chartData = data;
            //this.initD3();
        } else if (error) {
            console.error('Error fetching login data', error);
        }
    }*/

    async renderedCallback() {
        try {
            await getObservablePlotJS(this);
            if (window.Plot) {
                this.drawChart();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('plot failed to load plotting libs', e?.message,e?.stack);
        }
    }

    drawChart() {
        // 1. Convert Flat Apex Data to Hierarchical JSON
        const rootNode = { name: "Total Logins", children: [] };
        
        this.chartData.forEach(row => {
            const parts = row.path.split('/'); // ["login.salesforce.com", "Chrome", "Success"]
            let currentNode = rootNode;

            parts.forEach((part, index) => {
                // Try to find existing child
                let existingChild = currentNode.children.find(c => c.name === part);
                
                if (!existingChild) {
                    existingChild = { name: part, children: [] };
                    // If it's the last part (Leaf), add the value (User Count)
                    if (index === parts.length - 1) {
                        existingChild.value = row.userCount;
                    }
                    currentNode.children.push(existingChild);
                }
                currentNode = existingChild;
            });
        });

        // 2. Set up D3 Dimensions
        const width = 800;
        const height = 800;
        const container = this.template.querySelector('.d3-container');
        
        // Clear previous chart
        container.innerHTML = '';

        const svg = d3.select(container)
            .append('svg')
            .attr('viewBox', [0, 0, width, height])
            .style('font', '10px sans-serif');

        // 3. Create the Partition Layout
        // This calculates the x0, x1, y0, y1 coordinates for every rectangle
        const hierarchy = d3.hierarchy(rootNode)
            .sum(d => d.value) // Aggregates the values from leaves up to root
            .sort((a, b) => b.height - a.height || b.value - a.value);

        const root = d3.partition()
            .size([height, width]) // Note: We swap width/height for horizontal layout
            (hierarchy);

        // 4. Define Color Scale
        const color = d3.scaleOrdinal(d3.schemeTableau10);

        // 5. Draw the Rectangles (The Icicles)
        const cell = svg.selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y0},${d.x0})`);

        cell.append("rect")
            .attr("width", d => d.y1 - d.y0 - 1) // -1 for a tiny white gap
            .attr("height", d => d.x1 - d.x0 - 1)
            .attr("fill-opacity", 0.8)
            .attr("fill", d => {
                // Color by the "Application" level (Depth 2) or Root
                if (!d.depth) return "#ccc";
                while (d.depth > 1) d = d.parent; 
                return color(d.data.name); 
            });

        // 6. Add Text Labels
        // Only show text if the rectangle is tall enough (> 15px)
        cell.append("text")
            .style("user-select", "none")
            .attr("pointer-events", "none")
            .attr("x", 4)
            .attr("y", 13)
            .attr("fill-opacity", d => +this.labelVisible(d))
            .text(d => `${d.data.name} (${d.value})`);
            
        // Tooltip logic can be added here
    }
    
    labelVisible(d) {
        return (d.x1 - d.x0) > 15 ? 1 : 0; // Hide text if rect is too thin
    }
}