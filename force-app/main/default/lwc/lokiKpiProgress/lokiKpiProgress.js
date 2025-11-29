import { LightningElement, api } from 'lwc';

// --- Theme Constants for Styling ---
const GREEN_THEME = " color-green";
const RED_THEME = " color-red";
const ORANGE_THEME = " color-orange";
const NEUTRAL_THEME = " color-blue";

// --- Progress Ring Constants ---
const RING_RADIUS = 32;
const RING_STROKE_WIDTH = 6;

export default class LokiKpiProgress extends LightningElement {
    // --- Public API Properties ---
    @api title;
    @api usedValue;
    @api totalValue = 100;
    @api percent; // Optional override for calculated percentage

    @api autoFormat = false;
    @api inverseFormat = false;
    @api displayMode = 'ring'; // 'ring', 'bar', 'half-ring', 'fill'
    
    // --- Private Styling and Logic Properties ---
    _radius = RING_RADIUS;
    
    // Calculates the actual percentage (either provided or calculated)
    get actualPercent() {
        if (this.percent != null) {
            return this.percent;
        }

        const used = parseFloat(this.usedValue);
        const total = parseFloat(this.totalValue);

        if (!isNaN(used) && !isNaN(total) && total > 0) {
            // Clamp the value between 0 and 100
            return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
        }
        return 0;
    }

    // --- Ring/Circle Logic (Completed) ---
    get circumference() {
        return 2 * Math.PI * this._radius;
    }

    get dashArray() {
        return `${this.circumference} ${this.circumference}`;
    }

    get offset() {
        const percentage = this.actualPercent;
        // The stroke-dashoffset formula calculates the length of the *gap*.
        return this.circumference - (percentage / 100) * this.circumference;
    }

    get progressRingStyle() {
        // Dynamic style for the SVG circle path
        return `stroke-dashoffset: ${this.offset}; stroke: ${this.color};`;
    }
    
    // --- Conditional Rendering Logic ---
    get isRingMode() {
        return this.displayMode === 'ring';
    }
    
    get isBarMode() {
        return this.displayMode === 'bar';
    }
    
    get isHalfRingMode() {
        return this.displayMode === 'half-ring';
    }
    
    get isFillMode() {
        return this.displayMode === 'fill';
    }
    
    get isShowProgressVisual() {
        // Show the progress visual if it's not the default text-only mode
        return this.isRingMode || this.isHalfRingMode;
    }

    // --- Layout and Theming Logic ---

    // Determines the layout size for the text section based on whether the ring is shown
    get width(){
        return this.isShowProgressVisual ? 8 : 12;
    }
    
    // Determines the CSS class for the usedValue text color
    get categorizeStyle() {
        const className = this.getCategory();

        // Map the theme constant to a specific hex color for the ring and text
        let color = '#3b82f6'; // Blue (Default)
        if (className === RED_THEME) color = '#ef4444'; // Red
        else if (className === ORANGE_THEME) color = '#f59e0b'; // Orange
        else if (className === GREEN_THEME) color = '#10b981'; // Green (Added a hex value)
        this.color = color;

        return "slds-text-align_left " + className;
    }
    
    getCategory() {
        if (!this.autoFormat) return NEUTRAL_THEME;
        
        const percent = this.actualPercent;
        
        // Use inverseFormat to swap RED and GREEN meanings
        if (percent > 90) return this.inverseFormat ? GREEN_THEME : RED_THEME;
        else if (percent > 75) return ORANGE_THEME;
        else return this.inverseFormat ? RED_THEME : GREEN_THEME;
    }
    
    // Style for Progress Bar mode
    get progressBarWidth() {
        return `width: ${this.actualPercent}%; background-color: ${this.color};`;
    }

    // Style for fill percent text color
    get fillPercentStyle() {
        return this.color ? `color: ${this.color};` : '';
    }

    // Style for Fill Container mode
    get fillLevelStyle() {
        return `height: ${this.actualPercent}%; background-color: ${this.color};`;
    }
    
    // Style for Half-Ring SVG (needs rotation)
    get halfRingStyle() {
        // Transform for a half-ring (180 degrees)
        const rotation = (180 * this.actualPercent) / 100;
        return `transform: rotate(${rotation}deg); stroke: ${this.color};`;
    }
}