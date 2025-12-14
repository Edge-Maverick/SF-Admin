public with sharing class TechnicalHealthController {

    public class HealthStats {
        @AuraEnabled public Integer outdatedComponents { get; set; }
        @AuraEnabled public Integer objectsWithMultipleTriggers { get; set; }
        @AuraEnabled public Integer asyncErrors { get; set; }
        
        @AuraEnabled public Integer inactiveFlows { get; set; }
        @AuraEnabled public Integer failedInterviews { get; set; }
        
        @AuraEnabled public Integer expiredCerts { get; set; }
        @AuraEnabled public Integer expiringCerts { get; set; }

        @AuraEnabled public Integer staleUsers { get; set; }
        @AuraEnabled public Integer frozenUsers { get; set; }
        @AuraEnabled public Integer licenseUsagePercent { get; set; }

        @AuraEnabled public Integer activeProcessBuilders { get; set; }
        @AuraEnabled public Integer staleReports { get; set; }

        @AuraEnabled public Integer dataStoragePercent { get; set; }
        @AuraEnabled public Integer apiUsagePercent { get; set; }
    }

    public class DetailRecord {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public String extraInfo { get; set; } 
        @AuraEnabled public String recordUrl { get; set; } 
    }

    @AuraEnabled(cacheable=true)
    public static HealthStats getOrgHealthStats() {
        HealthStats stats = new HealthStats();
        Decimal targetVersion = 64.0;
        String todayStr = DateTime.now().format('yyyy-MM-dd');
        String warningStr = DateTime.now().addDays(180).format('yyyy-MM-dd');
        String staleUserDate = DateTime.now().addDays(-90).format('yyyy-MM-dd');
        String staleReportDate = DateTime.now().addDays(-365).format('yyyy-MM-dd');

        // 1. CODE
        stats.outdatedComponents = [SELECT COUNT() FROM ApexClass WHERE ApiVersion < :targetVersion] + 
                                   [SELECT COUNT() FROM ApexPage WHERE ApiVersion < :targetVersion];
        
        AggregateResult[] triggerResults = [SELECT TableEnumOrId FROM ApexTrigger GROUP BY TableEnumOrId HAVING COUNT(Id) > 1];
        stats.objectsWithMultipleTriggers = triggerResults.size();

        DateTime yesterday = DateTime.now().addDays(-1);
        stats.asyncErrors = [SELECT COUNT() FROM AsyncApexJob WHERE Status = 'Failed' AND CompletedDate >= :yesterday];

        // 2. AUTOMATION
        try {
            List<FlowDefinitionView> inactiveList = [SELECT Id FROM FlowDefinitionView WHERE IsActive = false];
            stats.inactiveFlows = inactiveList.size();
        } catch(Exception e) { stats.inactiveFlows = 0; }
        stats.failedInterviews = [SELECT COUNT() FROM FlowInterview];

        // 3. SECURITY
        stats.expiredCerts = 0; stats.expiringCerts = 0;
        try {
            stats.expiredCerts = Database.countQuery('SELECT COUNT() FROM Certificate WHERE ExpirationDate < ' + todayStr);
            stats.expiringCerts = Database.countQuery('SELECT COUNT() FROM Certificate WHERE ExpirationDate >= ' + todayStr + ' AND ExpirationDate <= ' + warningStr);
        } catch(Exception e) {}

        // 4. USERS
        try {
            stats.staleUsers = Database.countQuery('SELECT COUNT() FROM User WHERE IsActive = true AND LastLoginDate < ' + staleUserDate);
        } catch(Exception e) { stats.staleUsers = 0; }
        stats.frozenUsers = [SELECT COUNT() FROM UserLogin WHERE IsFrozen = true];

        try {
            UserLicense ul = [SELECT TotalLicenses, UsedLicenses FROM UserLicense WHERE Name = 'Salesforce' LIMIT 1];
            if(ul.TotalLicenses > 0) {
                stats.licenseUsagePercent = (Integer)((Decimal.valueOf(ul.UsedLicenses) / Decimal.valueOf(ul.TotalLicenses)) * 100);
            }
        } catch(Exception e) { stats.licenseUsagePercent = 0; }

        // 5. LEGACY
        try {
            stats.activeProcessBuilders = Database.countQuery('SELECT COUNT() FROM Flow WHERE Status = \'Active\' AND ProcessType = \'Workflow\'');
        } catch(Exception e) { stats.activeProcessBuilders = 0; }
        try {
            stats.staleReports = Database.countQuery('SELECT COUNT() FROM Report WHERE LastRunDate < ' + staleReportDate);
        } catch(Exception e) { stats.staleReports = 0; }

        // 6. LIMITS
        Map<String, System.OrgLimit> limits = System.OrgLimits.getMap();
        System.OrgLimit storage = limits.get('DataStorageMB');
        stats.dataStoragePercent = (storage != null && storage.getLimit() > 0) ? (Integer)((Decimal.valueOf(storage.getValue()) / Decimal.valueOf(storage.getLimit())) * 100) : 0;
        
        System.OrgLimit api = limits.get('DailyApiRequests');
        stats.apiUsagePercent = (api != null && api.getLimit() > 0) ? (Integer)((Decimal.valueOf(api.getValue()) / Decimal.valueOf(api.getLimit())) * 100) : 0;

        return stats;
    }

    @AuraEnabled(cacheable=true)
    public static List<DetailRecord> getHealthDetails(String metricType) {
        List<DetailRecord> details = new List<DetailRecord>();
        Decimal targetVersion = 64.0;
        String todayStr = DateTime.now().format('yyyy-MM-dd');
        String staleUserDate = DateTime.now().addDays(-90).format('yyyy-MM-dd');
        String companyInfoUrl = '/lightning/setup/CompanyProfileInfo/home';

        switch on metricType {
            when 'OUTDATED' {
                for(ApexClass ac : [SELECT Id, Name, ApiVersion FROM ApexClass WHERE ApiVersion < :targetVersion LIMIT 20]) {
                    details.add(createRecord(ac.Id, ac.Name, 'Apex Class', 'v' + ac.ApiVersion, '/' + ac.Id));
                }
            }
            when 'MULTIPLE_TRIGGERS' {
                AggregateResult[] results = [SELECT TableEnumOrId tId FROM ApexTrigger GROUP BY TableEnumOrId HAVING COUNT(Id) > 1];
                Set<String> objectNames = new Set<String>();
                for(AggregateResult ar : results) objectNames.add((String)ar.get('tId'));
                if(!objectNames.isEmpty()) {
                    for(ApexTrigger at : [SELECT Id, Name, TableEnumOrId FROM ApexTrigger WHERE TableEnumOrId IN :objectNames ORDER BY TableEnumOrId]) {
                        details.add(createRecord(at.Id, at.Name, 'Apex Trigger', 'Object: ' + at.TableEnumOrId, '/' + at.Id));
                    }
                }
            }
            when 'ASYNC_ERRORS' {
                DateTime yesterday = DateTime.now().addDays(-1);
                for(AsyncApexJob job : [SELECT Id, ApexClass.Name, JobType, ExtendedStatus FROM AsyncApexJob WHERE Status = 'Failed' AND CompletedDate >= :yesterday LIMIT 20]) {
                    details.add(createRecord(job.Id, job.ApexClass.Name, job.JobType, 'Error: ' + job.ExtendedStatus, '/' + job.Id));
                }
            }
            when 'INACTIVE_FLOWS' {
                try {
                    for(FlowDefinitionView fd : [SELECT Label, ApiName FROM FlowDefinitionView WHERE IsActive = false LIMIT 50]) {
                        details.add(createRecord(fd.ApiName, fd.Label, 'Flow Definition', 'Status: Inactive', '/lightning/setup/Flows/home'));
                    }
                } catch(Exception e) {}
            }
            when 'FAILED_INTERVIEWS' {
                for(FlowInterview fi : [SELECT Id, InterviewLabel FROM FlowInterview LIMIT 50]) {
                    details.add(createRecord(fi.Id, fi.InterviewLabel, 'Flow Interview', 'Paused/Failed', '/lightning/setup/FlowInterviews/home'));
                }
            }
            when 'EXPIRED_CERTS' {
                try {
                    String q = 'SELECT Id, DeveloperName, ExpirationDate FROM Certificate WHERE ExpirationDate < ' + todayStr;
                    List<SObject> certs = Database.query(q);
                    for(SObject c : certs) {
                        Date expDate = (Date)c.get('ExpirationDate');
                        details.add(createRecord((String)c.get('Id'), (String)c.get('DeveloperName'), 'Certificate', 'Expired: ' + expDate.format(), '/' + c.get('Id')));
                    }
                } catch(Exception e) {}
            }
            // FIX: Query IDs first, then Users
            when 'FROZEN_USERS' {
                Set<Id> userIds = new Set<Id>();
                for(UserLogin ul : [SELECT UserId FROM UserLogin WHERE IsFrozen = true LIMIT 50]) {
                    userIds.add(ul.UserId);
                }
                if(!userIds.isEmpty()) {
                    for(User u : [SELECT Id, Name, Username FROM User WHERE Id IN :userIds]) {
                        details.add(createRecord(u.Id, u.Name, 'Frozen User', 'Username: ' + u.Username, '/' + u.Id));
                    }
                }
            }
            when 'STALE_USERS' {
                try {
                    String q = 'SELECT Id, Name, LastLoginDate FROM User WHERE IsActive = true AND LastLoginDate < ' + staleUserDate + ' LIMIT 50';
                    List<SObject> users = Database.query(q);
                    for(SObject u : users) {
                        DateTime loginDt = (DateTime)u.get('LastLoginDate');
                        details.add(createRecord((String)u.get('Id'), (String)u.get('Name'), 'User', 'Last Login: ' + loginDt.format('yyyy-MM-dd'), '/' + u.get('Id')));
                    }
                } catch(Exception e) {}
            }
            when 'LICENSE_USAGE' {
                 UserLicense ul = [SELECT TotalLicenses, UsedLicenses, Name FROM UserLicense WHERE Name = 'Salesforce' LIMIT 1];
                 details.add(createRecord('LIC', ul.Name, 'User License', 'Used: ' + ul.UsedLicenses + ' / ' + ul.TotalLicenses, companyInfoUrl));
            }
            when 'PROCESS_BUILDERS' {
                try {
                    String q = 'SELECT Id, MasterLabel FROM Flow WHERE Status = \'Active\' AND ProcessType = \'Workflow\' LIMIT 50';
                    List<SObject> pbs = Database.query(q);
                    for(SObject p : pbs) {
                        details.add(createRecord((String)p.get('Id'), (String)p.get('MasterLabel'), 'Process Builder', 'Status: Active', '/lightning/setup/Flows/home'));
                    }
                } catch(Exception e) {}
            }
            when 'ORG_LIMITS' {
                Map<String, System.OrgLimit> limits = System.OrgLimits.getMap();
                
                System.OrgLimit storage = limits.get('DataStorageMB');
                Decimal usedMB = Decimal.valueOf(storage.getValue());
                Decimal limitMB = Decimal.valueOf(storage.getLimit());
                // Display GB if > 1024 MB
                String usedStr = (usedMB > 1024) ? (usedMB/1024).setScale(2) + ' GB' : usedMB + ' MB';
                String limitStr = (limitMB > 1024) ? (limitMB/1024).setScale(0) + ' GB' : limitMB + ' MB';
                
                details.add(createRecord('DATA', 'Data Storage', 'Org Limit', 'Usage: ' + usedStr + ' / ' + limitStr, companyInfoUrl));
                
                System.OrgLimit api = limits.get('DailyApiRequests');
                details.add(createRecord('API', 'Daily API Requests', 'Org Limit', 'Usage: ' + api.getValue() + ' / ' + api.getLimit(), companyInfoUrl));
            }
        }
        return details;
    }

    private static DetailRecord createRecord(String id, String name, String type, String extra, String url) {
        DetailRecord d = new DetailRecord();
        d.id = id;
        d.name = name;
        d.type = type;
        d.extraInfo = extra;
        d.recordUrl = url;
        return d;
    }
}