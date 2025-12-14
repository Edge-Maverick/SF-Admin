public with sharing class DeploymentCalendarController {
    
    @AuraEnabled
    public static Event saveEvent(String eventId, String subject, DateTime startDateTime, DateTime endDateTime, String description) {
        try {
            Event eventToSave = new Event(
                Subject = subject,
                StartDateTime = startDateTime,
                EndDateTime = endDateTime,
                Description = description
            );
            
            if (String.isNotBlank(eventId)) {
                eventToSave.Id = eventId;
            }
            
            upsert eventToSave;
            return eventToSave;
        } catch (Exception e) {
            throw new AuraHandledException('Error saving event: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Event> getMonthEvents(Integer month, Integer year) {
        // Calculate start and end of the month
        DateTime startOfMonth = DateTime.newInstance(year, month, 1, 0, 0, 0);
        Integer numberOfDays = Date.daysInMonth(year, month);
        DateTime endOfMonth = DateTime.newInstance(year, month, numberOfDays, 23, 59, 59);

        // Fetch events falling within this range
        // We look for events that start or end within the month, or span across the month
        return [
            SELECT Id, Subject, StartDateTime, EndDateTime, Description, Owner.Name
            FROM Event 
            WHERE (StartDateTime >= :startOfMonth AND StartDateTime <= :endOfMonth)
               OR (EndDateTime >= :startOfMonth AND EndDateTime <= :endOfMonth)
               OR (StartDateTime < :startOfMonth AND EndDateTime > :endOfMonth)
            ORDER BY StartDateTime ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Event> getUpcomingEvents(Integer daysToCheck) {
        DateTime now = DateTime.now();
        DateTime future = now.addDays(daysToCheck);
        
        return [
            SELECT Id, Subject, StartDateTime, EndDateTime, Description
            FROM Event 
            WHERE StartDateTime >= :now AND StartDateTime <= :future
            ORDER BY StartDateTime ASC
        ];
    }
}
