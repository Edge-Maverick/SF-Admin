import { LightningElement, wire, track } from 'lwc';
import getSecurityScore from '@salesforce/apex/AdminSecurityController.getSecurityScore';

export default class HealthCheckScore extends LightningElement {
    @track score = 0;
    @track status = 'Checking...';

    connectedCallback() {
        this.fetchScore();
    }

    fetchScore() {
        getSecurityScore()
            .then(data => {
                if (data) {
                    this.score = data.score;
                    this.status = data.status;
                    this.animateScore(data.score);
                }
            })
            .catch(error => {
                this.status = 'Error';
                console.error('Error fetching score:', error);
            });
    }

    animateScore(finalScore) {
        // Simple animation logic if needed, or just set it
        // For now, we rely on CSS transition, just ensuring the value is set
    }

    get gaugeStyle() {
        // Conic gradient: score color up to score%, transparent/grey after
        // We use a CSS variable or direct style
        const color = this.getScoreColor(this.score);
        return `background: conic-gradient(${color} 0% ${this.score}%, #e0e0e0 ${this.score}% 100%);`;
    }

    get scoreColorClass() {
        if (this.score >= 90) return 'score-text excellent';
        if (this.score >= 80) return 'score-text good';
        if (this.score >= 70) return 'score-text fair';
        return 'score-text poor';
    }

    getScoreColor(score) {
        if (score >= 90) return '#04844b'; // Excellent Green
        if (score >= 80) return '#ffb75d'; // Good Yellow/Orange
        if (score >= 70) return '#ffb75d'; // Fair Orange
        return '#c23934'; // Poor Red
    }
}
