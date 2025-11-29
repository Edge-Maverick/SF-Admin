public with sharing class SetupAuditTrailController {
    
    @AuraEnabled
    public static List<SetupAuditTrailWrapper> getSetupAuditTrailLogs(Date startDate, Date endDate) {
        try {
            // Default to last 7 days if no dates provided
            if (startDate == null) {
                startDate = Date.today().addDays(-7);
            }
            if (endDate == null) {
                endDate = Date.today();
            }
            
            // Add one day to endDate to include the full day (since CreatedDate is DateTime)
            DateTime startDateTime = DateTime.newInstance(startDate.year(), startDate.month(), startDate.day(), 0, 0, 0);
            DateTime endDateTime = DateTime.newInstance(endDate.year(), endDate.month(), endDate.day(), 23, 59, 59);

            List<SetupAuditTrail> logs = [
                SELECT Id, Action, Section, Display, CreatedDate, CreatedBy.Name 
                FROM SetupAuditTrail 
                WHERE CreatedDate >= :startDateTime AND CreatedDate <= :endDateTime
                ORDER BY CreatedDate DESC
                LIMIT 1000
            ];

            List<SetupAuditTrailWrapper> wrapperList = new List<SetupAuditTrailWrapper>();
            for(SetupAuditTrail log : logs){
                SetupAuditTrailWrapper wrapper = new SetupAuditTrailWrapper();
                wrapper.Id = log.Id;
                wrapper.Action = log.Action;
                wrapper.Section = log.Section != null ? log.Section : 'Other'; // Handle null sections
                wrapper.Display = log.Display;
                wrapper.CreatedDate = log.CreatedDate;
                wrapper.CreatedByName = log.CreatedBy.Name;
                wrapperList.add(wrapper);
            }

            return wrapperList;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class SetupAuditTrailWrapper {
        @AuraEnabled public String Id;
        @AuraEnabled public String Action;
        @AuraEnabled public String Section;
        @AuraEnabled public String Display;
        @AuraEnabled public DateTime CreatedDate;
        @AuraEnabled public String CreatedByName;
    }
}
