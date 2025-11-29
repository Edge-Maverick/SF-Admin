import { LightningElement,api } from 'lwc';

// POSITIVE / GOOD → GREEN
const GREEN_WORDS = new Set([
  "YES", "GOOD", "GREAT", "HIGH", "EXCELLENT", "POSITIVE", "STRONG",
  "SUCCESS", "SUCCESSFUL", "OPTIMAL", "OPTIMIZED", "HEALTHY",
  "ENHANCED", "IMPROVED", "FAST", "EFFICIENT", "STABLE",
  "NORMAL", "UP", "INCREASE", "SAFE", "SECURE",
  "APPROVED", "VALID", "PASS", "COMPLETED", "ACTIVE"
]);

// NEGATIVE / BAD → RED
const RED_WORDS = new Set([
  "NO", "NOT", "BAD", "LOW", "NEGATIVE", "CRITICAL", "FAIL", "FAILED",
  "ERROR", "WEAK", "DOWN", "POOR", "RISK", "THREAT",
  "UNSTABLE", "BLOCKED", "REJECTED", "DENIED",
  "UNSAFE", "SLOW", "STOP", "DECREASE"
]);

// MEDIUM / WARNING → ORANGE
const ORANGE_WORDS = new Set([
  "AVERAGE", "MEDIUM", "MODERATE", "WARNING", "CAUTION",
  "NEUTRAL", "PENDING", "REVIEW", "LIMITED", "PARTIAL",
  "DEGRADED", "INTERMEDIATE", "TRANSIENT", "OKAY", "OK",
  "SOME", "SOMEWHAT", "SOMETIMES", "SOMETIME",
]);

const GREEN_THEME = " color-green";
const RED_THEME = " color-red";
const ORANGE_THEME = " color-orange";
const NEUTRAL_THEME = " color-blue";

export default class LokiText extends LightningElement {
    @api title;
    @api text;
    @api subText;

    @api hideIcon = false;

    @api format;
    @api autoFormat = false;
    @api inverseFormat = false;

    get displayIcon(){
        return !this.hideIcon;
    }
    get width(){
        if ( this.hideIcon)
            return 12;
        return 9;
    }

    get categorizeStyle() {
        return (this.hideIcon? "center-vertically ":"slds-text-align_left ")+this.getCategory();
    }
    /**
     * Returns GREEN, RED, ORANGE, or NEUTRAL based on meaning.
     */
    getCategory() {
        if (this.format){
            if (this.format === "green") return GREEN_THEME;
            else if (this.format === "red") return RED_THEME;
            else if (this.format === "orange") return ORANGE_THEME;
            else return NEUTRAL_THEME;
        }
        if (!this.autoFormat) return NEUTRAL_THEME;

        const input = this.text;
        if (!input || typeof input !== "string") return NEUTRAL_THEME;

        // Normalize text
        const cleaned = input
            .trim()
            .replace(/[^a-zA-Z0-9\s]/g, "") // remove special chars
            .replace(/\s+/g, " ")           // normalize space
            .toUpperCase();

        if (GREEN_WORDS.has(cleaned)) return this.inverseFormat?RED_THEME:GREEN_THEME;
        if (RED_WORDS.has(cleaned)) return this.inverseFormat?GREEN_THEME:RED_THEME;
        if (ORANGE_WORDS.has(cleaned)) return ORANGE_THEME;
        return NEUTRAL_THEME;
    }
    
}