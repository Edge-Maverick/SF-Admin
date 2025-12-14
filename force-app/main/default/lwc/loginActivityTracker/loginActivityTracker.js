import { LightningElement, wire, track } from 'lwc';
import getLoginRisks from '@salesforce/apex/AdminSecurityController.getLoginRisks';
import resetUserPassword from '@salesforce/apex/AdminSecurityController.resetUserPassword';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class LoginActivityTracker extends LightningElement {
    @track risks = { potentialBruteForceCount: 0, riskyUsers: [] };
    @track showRiskyUsers = false;
    @track mapMarkers = [];
    @track showMap = false;
    @track isModalOpen = false;

    mapOptions = {
        disableDefaultUI: true, // Enable zoom controls etc.
        draggable: true,         // Enable dragging
        zoomControl: false,       // Enable dragging
        mapTypeControl: false,   // Disable map type control
        scaleControl: false,     // Disable scale control,
        scrollwheel: true       // Disable scroll zoom to prevent page scroll interruption, unless user wants it. Keeping false for mini-map best practice.
    };

    columns = [
        { label: 'User', fieldName: 'userName', type: 'text' },
        { label: 'Issue', fieldName: 'issueType', type: 'text' },
        { label: 'Failures', fieldName: 'failureCount', type: 'number', cellAttributes: { alignment: 'left' } },
        { label: 'IP Address', fieldName: 'ipAddress', type: 'text' },
        { label: 'Last Attempt', fieldName: 'lastAttemptTime', type: 'date', 
          typeAttributes: { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" } },
        { type: 'button', typeAttributes: { 
            label: { fieldName: 'resetLabel' }, 
            name: 'reset_password', 
            title: 'Reset User Password', 
            disabled: { fieldName: 'resetDisabled' }, 
            value: 'reset_password', 
            iconName: { fieldName: 'resetIcon' },
            variant: 'base'
        }}
    ];

    @wire(getLoginRisks)
    wiredRisks({ error, data }) {
        if (data) {
            // Process Risky Users to add dynamic button properties
            let processedUsers = [];
            if (data.riskyUsers) {
                processedUsers = data.riskyUsers.map(user => {
                    const isLocked = user.issueType === 'Account Locked';
                    return {
                        ...user,
                        resetLabel: isLocked ? 'Reset Password' : '',
                        resetDisabled: !isLocked,
                        resetIcon: isLocked ? 'utility:password' : ''
                    };
                });
            }

            this.risks = { ...data, riskyUsers: processedUsers };
            this.showRiskyUsers = processedUsers.length > 0;
            
            // Process Map Markers
            if (data.loginLocations && data.loginLocations.length > 0) {
                this.mapMarkers = data.loginLocations.map(loc => {
                    return {
                        location: {
                            City: loc.city,
                            Country: loc.country
                        },
                        title: `${loc.city}, ${loc.country}`,
                        description: `${loc.count} Successful Logins`
                    };
                });
                this.showMap = true;
            } else {
                this.mapMarkers = [];
                this.showMap = false;
            }
        } else if (error) {
            console.error('Error fetching login risks', error);
        }
    }

    handleOpenModal() {
        this.isModalOpen = true;
    }

    handleCloseModal() {
        this.isModalOpen = false;
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'reset_password') {
            resetUserPassword({ userId: row.userId })
                .then(() => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: `Password reset triggered for ${row.userName}`,
                            variant: 'success'
                        })
                    );
                })
                .catch(error => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error',
                            message: error.body ? error.body.message : error.message,
                            variant: 'error'
                        })
                    );
                });
        }
    }
}
