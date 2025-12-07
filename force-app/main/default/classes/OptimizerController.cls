public with sharing class OptimizerController {

    @AuraEnabled
    public static OptimizerResult scanOrg(Boolean forceScan) {
        // Check for recent cached result (e.g., from today)
        if (!forceScan) {
            List<Optimizer_Log__c> recentLogs = [SELECT CreatedDate, Result_JSON__c FROM Optimizer_Log__c WHERE CreatedDate = TODAY ORDER BY CreatedDate DESC LIMIT 1];
            if (!recentLogs.isEmpty()) {
                try {
                    OptimizerResult cachedResult = (OptimizerResult) JSON.deserialize(recentLogs[0].Result_JSON__c, OptimizerResult.class);
                    cachedResult.lastScanned = recentLogs[0].CreatedDate;
                    return cachedResult;
                } catch (Exception e) {
                    System.debug('Error parsing cached result: ' + e.getMessage());
                    // Fall through to re-scan
                }
            }
        }

        OptimizerResult result = new OptimizerResult();
        
        result.unusedProfiles = getUnusedProfiles();
        result.unusedPermissionSets = getUnusedPermissionSets();
        result.privilegedUsers = getPrivilegedUsers();
        result.hardCodedUrlClasses = getHardCodedUrlClasses();
        
        // New Metrics
        result.unassignedRoles = getUnassignedRoles();
        result.neverLoggedInUsers = getNeverLoggedInUsers();
        result.staleReports = getStaleReports();
        result.emptyPublicGroups = getEmptyPublicGroups();
        
        // Advanced Metrics
        result.oldApiClasses = getOldApiClasses();
        result.activeProcessBuilders = getActiveProcessBuilders();
        
        // Save Result to Cache
        try {
            Optimizer_Log__c log = new Optimizer_Log__c();
            log.Result_JSON__c = JSON.serialize(result);
            insert log;
            result.lastScanned = DateTime.now();
        } catch(Exception e) {
             System.debug('Error saving cache: ' + e.getMessage());
        }

        return result;
    }

    // ... existing private methods ...

    private static List<ResultItem> getUnassignedRoles() {
        List<ResultItem> items = new List<ResultItem>();
        // Roles that are not assigned to any active user
        // Using NOT IN logic similar to Profiles
        for(UserRole r : [SELECT Id, Name FROM UserRole WHERE Id NOT IN (SELECT UserRoleId FROM User WHERE IsActive=true) LIMIT 100]) {
            items.add(new ResultItem(r.Id, r.Name, 'UserRole'));
        }
        return items;
    }

    private static List<ResultItem> getNeverLoggedInUsers() {
        List<ResultItem> items = new List<ResultItem>();
        // Active users created > 30 days ago who have never logged in
        DateTime thirtyDaysAgo = DateTime.now().addDays(-30);
        for(User u : [SELECT Id, Name FROM User WHERE IsActive=true AND LastLoginDate = null AND CreatedDate < :thirtyDaysAgo AND UserType = 'Standard' LIMIT 100]) {
             items.add(new ResultItem(u.Id, u.Name, 'User'));
        }
        return items;
    }

    private static List<ResultItem> getStaleReports() {
        List<ResultItem> items = new List<ResultItem>();
        // Reports not run in last 12 months
        DateTime yearAgo = DateTime.now().addMonths(-12);
        // Using LastRunDate from Report
        for(Report r : [SELECT Id, Name, LastRunDate FROM Report WHERE LastRunDate < :yearAgo OR LastRunDate = null LIMIT 100]) {
             String info = r.LastRunDate == null ? 'Never run' : r.LastRunDate.format();
             items.add(new ResultItem(r.Id, r.Name + ' (Last Run: ' + info + ')', 'Report'));
        }
        return items;
    }

    private static List<ResultItem> getEmptyPublicGroups() {
        List<ResultItem> items = new List<ResultItem>();
        // Public Groups (Regular) with no members
        // Group Type 'Regular' is for Public Groups.
        for(Group g : [SELECT Id, Name FROM Group WHERE Type='Regular' AND Id NOT IN (SELECT GroupId FROM GroupMember) LIMIT 100]) {
             items.add(new ResultItem(g.Id, g.Name, 'Group'));
        }
        return items;
    }

    private static List<ResultItem> getOldApiClasses() {
        List<ResultItem> items = new List<ResultItem>();
        
        Decimal currentOrgVersion = OrgOverviewController.getCurrentApiVersion();
        
        // Fetch specific fields needed: ApiVersion, CreatedDate
        for(ApexClass ac : [SELECT Id, Name, ApiVersion, CreatedDate FROM ApexClass WHERE NamespacePrefix = null LIMIT 200]) {
             
             Boolean isFlagged = false;
             String reason = '';

             // Check 1: Absolute Old (Current - 9)
             // e.g., if Current is 60, anything < 51 is Old.
             if (ac.ApiVersion < (currentOrgVersion - 9)) {
                 isFlagged = true;
                 reason = 'Very Old Version (v' + ac.ApiVersion + ')';
             } 
             else {
                 // Check 2: Relative Old (Created with old version)
                 // e.g., Created in 2024 (Available v60) but used v45.
                 // Threshold: If used version is < (AvailableAtCreation - 9)
                 Decimal versionAtCreation = OrgOverviewController.getApiVersionAtDate(ac.CreatedDate.date());
                 if (ac.ApiVersion < (versionAtCreation - 9)) {
                     isFlagged = true;
                     reason = 'Created as Legacy (v' + ac.ApiVersion + ' when v' + versionAtCreation + ' was available)';
                 }
             }

             if (isFlagged) {
                 items.add(new ResultItem(ac.Id, ac.Name + ' [' + reason + ']', 'ApexClass'));
             }
        }
        return items;
    }

    private static List<ResultItem> getActiveProcessBuilders() {
        List<ResultItem> items = new List<ResultItem>();
        try {
             // Use Dynamic SOQL and generic SObject to avoid 'Invalid Type: Flow' compile error
             // if the org doesn't support the Flow object directly or API version issues persist.
             String query = 'SELECT Id, MasterLabel, VersionNumber FROM Flow WHERE ProcessType = \'Workflow\' AND Status = \'Active\' LIMIT 100';
             List<SObject> flows = Database.query(query);
             
             for(SObject f : flows) {
                  String label = (String) f.get('MasterLabel');
                  Integer version = (Integer) f.get('VersionNumber');
                  items.add(new ResultItem((Id)f.get('Id'), label + ' (v' + version + ')', 'ProcessBuilder'));
             }
        } catch (Exception e) {
            System.debug('Error querying Flow object: ' + e.getMessage());
            // Optional: Try FlowDefinitionView fallback if Flow object fails
        }
        return items;
    }


    public class OptimizerResult {
        @AuraEnabled public List<ResultItem> unusedProfiles;
        @AuraEnabled public List<ResultItem> unusedPermissionSets;
        @AuraEnabled public List<ResultItem> privilegedUsers;
        @AuraEnabled public List<ResultItem> hardCodedUrlClasses;
        
        // New Metrics
        @AuraEnabled public List<ResultItem> unassignedRoles;
        @AuraEnabled public List<ResultItem> neverLoggedInUsers;
        @AuraEnabled public List<ResultItem> staleReports;
        @AuraEnabled public List<ResultItem> emptyPublicGroups;
        @AuraEnabled public List<ResultItem> oldApiClasses;
        @AuraEnabled public List<ResultItem> activeProcessBuilders;
        @AuraEnabled public DateTime lastScanned;
    }

    private static List<ResultItem> getUnusedProfiles() {
        List<ResultItem> items = new List<ResultItem>();
        // Query profiles not assigned to any active user
        // Note: This is an approximation. Large orgs might hit limits with NOT IN.
        // For a simple scanner, we can try query 2 lists and diff them in memory if needed, 
        // but SOQL NOT IN is fastest for small-medium orgs.
        
        for(Profile p : [SELECT Id, Name FROM Profile WHERE Id NOT IN (SELECT ProfileId FROM User WHERE IsActive=true) LIMIT 100]) {
            items.add(new ResultItem(p.Id, p.Name, 'Profile'));
        }
        return items;
    }

    private static List<ResultItem> getUnusedPermissionSets() {
        List<ResultItem> items = new List<ResultItem>();
        // Custom perm sets not assigned to anyone
        for(PermissionSet ps : [SELECT Id, Name FROM PermissionSet WHERE IsCustom=true AND Id NOT IN (SELECT PermissionSetId FROM PermissionSetAssignment) LIMIT 100]) {
             items.add(new ResultItem(ps.Id, ps.Name, 'PermissionSet'));
        }
        return items;
    }

    private static List<ResultItem> getPrivilegedUsers() {
        List<ResultItem> items = new List<ResultItem>();
        // Users with Modify All Data or Customize Application via Profile
        for(User u : [SELECT Id, Name, Profile.Name FROM User WHERE IsActive=true AND (Profile.PermissionsModifyAllData=true OR Profile.PermissionsCustomizeApplication=true) LIMIT 100]) {
             items.add(new ResultItem(u.Id, u.Name + ' (' + u.Profile.Name + ')', 'User'));
        }
        return items;
    }

    private static List<ResultItem> getHardCodedUrlClasses() {
        List<ResultItem> items = new List<ResultItem>();
        String[] terms = new String[]{'salesforce.com', 'force.com', 'na1.visual.force.com'}; // simple examples
        
        // This is a naive search. A real search might need Tooling API or a more robust text search.
        // We will just search for strings in Body.
        // SOSL might be better but let's stick to SOQL on ApexClass for now if possible, or simple looping.
        // Searching Body in SOQL: explicitly disallowed for ApexClass in some contexts or inefficient?
        // Actually, we can't filter on Body in SOQL for ApexClass. 
        // We have to query and filter in memory, which is risky for heap size.
        // Let's use SOSL.
        
        List<List<SObject>> searchList = [FIND 'salesforce.com OR force.com' IN ALL FIELDS RETURNING ApexClass(Id, Name, Body WHERE NamespacePrefix = null)];
        if(searchList != null && !searchList.isEmpty()){
            for(ApexClass ac : (List<ApexClass>)searchList[0]){
                 if(ac.Body.containsIgnoreCase('salesforce.com') || ac.Body.containsIgnoreCase('force.com')){
                     // Double check logic to avoid false positives like imports or standard comments if possible
                     // keeping it simple for now
                     items.add(new ResultItem(ac.Id, ac.Name, 'ApexClass'));
                 }
            }
        }
        return items;
    }




    public class ResultItem {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String type;

        public ResultItem(String id, String name, String type) {
            this.id = id;
            this.name = name;
            this.type = type;
        }
    }
}
