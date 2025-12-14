import { LightningElement, track, wire } from 'lwc';
import getMonthEvents from '@salesforce/apex/DeploymentCalendarController.getMonthEvents';
import getUpcomingEvents from '@salesforce/apex/DeploymentCalendarController.getUpcomingEvents';
import createEvent from '@salesforce/apex/DeploymentCalendarController.createEvent';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default class DeploymentCalendar extends LightningElement {
    @track currentDate = new Date();
    @track calendarDays = [];
    @track newEvent = {
        Subject: '[DevOps] ',
        StartDateTime: '',
        EndDateTime: '',
        Description: ''
    };
    @track isModalOpen = false;
    @track upcomingEvents = [];
    @track hasAlert = true;

    connectedCallback() {
        this.generateCalendar();
    }

    get currentMonthName() {
        return MONTH_NAMES[this.currentDate.getMonth()];
    }

    get currentYear() {
        return this.currentDate.getFullYear();
    }

    @wire(getUpcomingEvents, { daysToCheck: 2 })
    wiredAlerts({ error, data }) {
        if (data && data.length > 0) {
            this.upcomingEvents = data;
        } else if (error) {
            console.error('Error fetching alerts', error);
        }
    }

    @track wiredEventsResult;

    @wire(getMonthEvents, { month: '$currentMonthNumber', year: '$currentYearNumber' })
    wiredEvents(result) {
        this.wiredEventsResult = result;
        const { error, data } = result;
        if (data) {
            this.mapEventsToCurrentCalendar(data);
        } else if (error) {
            console.error('Error fetching month events', error);
        }
    }

    get currentMonthNumber() {
        return this.currentDate.getMonth() + 1; // Apex expects 1-12
    }

    get currentYearNumber() {
        return this.currentDate.getFullYear();
    }

    get hasUpcomingEvents() {
        return this.hasAlert && this.upcomingEvents.length > 0;
    }

    get nextEventSubject() {
        return this.upcomingEvents[0]?.Subject || '';
    }

    get daysUntilNextEvent() {
        if (!this.upcomingEvents[0]) return 0;
        const eventDate = new Date(this.upcomingEvents[0].StartDateTime);
        const today = new Date();
        const diffTime = Math.abs(eventDate - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays;
    }

    dismissAlert() {
        this.hasAlert = false;
    }

    handlePrevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.currentDate = new Date(this.currentDate);
        this.generateCalendar();
    }

    handleNextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.currentDate = new Date(this.currentDate);
        this.generateCalendar();
    }

    handleToday() {
        this.currentDate = new Date();
        this.generateCalendar();
    }

    generateCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Days from previous month
        const prevMonthDays = [];
        const prevMonthLastDate = new Date(year, month, 0).getDate();
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            prevMonthDays.push({
                dayNumber: prevMonthLastDate - i,
                classNames: 'calendar-day other-month',
                id: `prev-${i}`
            });
        }

        // Days of current month
        const currentMonthDays = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === new Date().getDate() && 
                           month === new Date().getMonth() && 
                           year === new Date().getFullYear();
            
            // Format for data-date: YYYY-MM-DD
            const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            currentMonthDays.push({
                dayNumber: i,
                classNames: isToday ? 'calendar-day today' : 'calendar-day',
                id: `curr-${i}`,
                dateStr: dateStr,
                events: [] // Will be populated by wire
            });
        }

        this.calendarDays = [...prevMonthDays, ...currentMonthDays];
        // Note: Logic to map events will happen when wire returns
    }

    mapEventsToCurrentCalendar(events) {
        // Simple mapping: if event starts on a day, show it
        // Re-generate basic calendar to clear old events
        this.generateCalendar(); 

        const daysMap = {};
        this.calendarDays.forEach(day => {
            if(day.dateStr) daysMap[day.dateStr] = day;
        });

        events.forEach(evt => {
            const startDate = new Date(evt.StartDateTime);
            const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
            
            if(daysMap[dateStr]) {
                daysMap[dateStr].events.push(evt);
            }
        });
        
        // Trigger re-render
        this.calendarDays = [...this.calendarDays];
    }

    handleDayClick(event) {
        const dateStr = event.currentTarget.dataset.date;
        if(dateStr) {
            // Set default start time to that day at 9 AM
            this.newEvent.StartDateTime = `${dateStr}T09:00:00.000Z`;
            this.newEvent.EndDateTime = `${dateStr}T10:00:00.000Z`;
            this.openModal();
        }
    }

    openModal() {
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        this.newEvent[field] = event.target.value;
    }

    handleSaveEvent() {
        createEvent({
            subject: this.newEvent.Subject,
            startDateTime: this.newEvent.StartDateTime,
            endDateTime: this.newEvent.EndDateTime,
            description: this.newEvent.Description
        })
        .then(() => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Event created',
                    variant: 'success'
                })
            );
            this.closeModal();
            // Refresh logic - ideally we'd refresh the wired result
            // returning to basic view for now or forcing refresh in production
            // For now, let's just wait for wire to refresh naturally or user action
             return refreshApex(this.wiredEventsResult);
        })
        .catch(error => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error creating event',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                })
            );
        });
    }
}
