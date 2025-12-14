public with sharing class SetupAuditTrailController {
    
    // Wrapper class to group parameters and resolve PMD "ExcessiveParameterList" violation
    public class AuditTrailRequest {
        @AuraEnabled public Date startDate { get; set; }
        @AuraEnabled public Date endDate { get; set; }
        @AuraEnabled public DateTime lastCreatedDate { get; set; }
        @AuraEnabled public String lastId { get; set; }
    }

    @AuraEnabled
    public static List<SetupAuditTrailWrapper> getSetupAuditTrailLogs(AuditTrailRequest request) {
        try {
            // Validate request object
            if (request == null) {
                throw new AuraHandledException('Request parameters cannot be null.');
            }

            Date startDate = request.startDate;
            Date endDate = request.endDate;
            DateTime lastCreatedDate = request.lastCreatedDate;
            String lastId = request.lastId;

            // Default to last 7 days if no dates provided
            if (startDate == null) {
                startDate = Date.today().addDays(-7);
            }
            if (endDate == null) {
                endDate = Date.today();
            }
            
            // Validate Date Range (Server-side safety net)
            if (startDate.daysBetween(endDate) > 7) {
                throw new AuraHandledException('Date range cannot exceed 7 days.');
            }

            // Time boundaries
            DateTime startDateTime = DateTime.newInstance(startDate.year(), startDate.month(), startDate.day(), 0, 0, 0);
            DateTime endDateTime = DateTime.newInstance(endDate.year(), endDate.month(), endDate.day(), 23, 59, 59);

            // Security Check
            if (!Schema.sObjectType.SetupAuditTrail.isAccessible()) {
                throw new AuraHandledException('Insufficient permissions to view Setup Audit Trail.');
            }

            // Build Query
            String query = 'SELECT Id, Action, Section, Display, CreatedDate, CreatedBy.Name FROM SetupAuditTrail WHERE CreatedDate >= :startDateTime AND CreatedDate <= :endDateTime';
            
            // Keyset Pagination: If we have a last record, fetch records older than that (or same time but smaller ID)
            if (lastCreatedDate != null && String.isNotBlank(lastId)) {
                query += ' AND (CreatedDate < :lastCreatedDate OR (CreatedDate = :lastCreatedDate AND Id < :lastId))';
            }

            query += ' ORDER BY CreatedDate DESC, Id DESC LIMIT 1000';

            List<SetupAuditTrail> logs = Database.query(query);

            List<SetupAuditTrailWrapper> wrapperList = new List<SetupAuditTrailWrapper>();
            for(SetupAuditTrail log : logs){
                SetupAuditTrailWrapper wrapper = new SetupAuditTrailWrapper();
                wrapper.id = log.Id;
                wrapper.action = log.Action;
                wrapper.section = log.Section != null ? log.Section : 'Other'; 
                wrapper.display = log.Display;
                wrapper.createdDate = log.CreatedDate;
                wrapper.createdByName = log.CreatedBy.Name;
                wrapperList.add(wrapper);
            }

            return wrapperList;

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'SetupAuditTrailController Error: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage()); 
        }
    }

    public class SetupAuditTrailWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String action;
        @AuraEnabled public String section;
        @AuraEnabled public String display;
        @AuraEnabled public DateTime createdDate;
        @AuraEnabled public String createdByName;
    }
}