public with sharing class AdminSecurityController {

    public class SecurityScoreWrapper {
        @AuraEnabled public Integer score;
        @AuraEnabled public String status; // Excellent, Good, Poor
    }

    public class LoginRiskWrapper {
        @AuraEnabled public Integer potentialBruteForceCount;
        @AuraEnabled public List<LoginLocationWrapper> loginLocations;
        @AuraEnabled public List<RiskyUserDetail> riskyUsers;
    }

    public class LoginLocationWrapper {
        @AuraEnabled public String city;
        @AuraEnabled public String country;
        @AuraEnabled public Integer count;
    }

    public class RiskyUserDetail {
        @AuraEnabled public String userId;
        @AuraEnabled public String userName;
        @AuraEnabled public String issueType; // 'Brute Force Attempt', 'Account Locked'
        @AuraEnabled public Integer failureCount;
        @AuraEnabled public String ipAddress; // Most recent IP
        @AuraEnabled public DateTime lastAttemptTime;
    }
    
    public class CriticalLogWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String action;
        @AuraEnabled public String display; 
        @AuraEnabled public String createdBy;
        @AuraEnabled public DateTime createdDate;
        @AuraEnabled public String section;
        
        // New actionable fields
        @AuraEnabled public String target;   // e.g. "Tech Debt Admin"
        @AuraEnabled public String operation;// e.g. "assigned to user X"
        @AuraEnabled public String type;     // e.g. "Perm Set"
        @AuraEnabled public List<String> riskList; // e.g. ["Modify All Data", "Manage Users"]
        @AuraEnabled public String targetId; // Change Record ID (e.g. PermissionSetId)

        // Assignee Details for Popover
        @AuraEnabled public String assigneeId;
        @AuraEnabled public String assigneeName;
        @AuraEnabled public String assigneeTitle;
        @AuraEnabled public String assigneeRole;
        @AuraEnabled public String assigneeManager;
        @AuraEnabled public Boolean assigneeActive;
    }

    @AuraEnabled(cacheable=true)
    public static LoginRiskWrapper getLoginRisks() {
        LoginRiskWrapper result = new LoginRiskWrapper();
        result.potentialBruteForceCount = 0;
        result.loginLocations = new List<LoginLocationWrapper>();
        result.riskyUsers = new List<RiskyUserDetail>();

        try {
            // 1. Analyze Login History for Brute Force & Lockouts (Last 24 Hours)
            DateTime last24h = DateTime.now().addDays(-1);
            
            // Note: LoginHistory is a big object, fine for last 24h in most orgs, but query carefully.
            // Aggregating locally because LoginHistory doesn't support aggregate queries well in all contexts or might be huge.
            // Limit 2000 to prevent governor limits, focusing on most recent.
            List<LoginHistory> recentFailures = [
                SELECT UserId, Status, LoginTime, SourceIp 
                FROM LoginHistory 
                WHERE LoginTime >= :last24h 
                ORDER BY LoginTime DESC
                LIMIT 2000
            ];

            Map<Id, Integer> failureCounts = new Map<Id, Integer>();
            Map<Id, LoginHistory> lastAttemptMap = new Map<Id, LoginHistory>();
            Set<Id> lockedOutUserIds = new Set<Id>();

            for (LoginHistory wh : recentFailures) {
                if (wh.UserId == null) continue; 
                // Filter relevant statuses in Apex (SOQL limitation for some contexts)
                if (wh.Status != 'Invalid Password' && wh.Status != 'Password Lockout') {
                    continue;
                }

                // Track counts
                if (!failureCounts.containsKey(wh.UserId)) {
                    failureCounts.put(wh.UserId, 0);
                    lastAttemptMap.put(wh.UserId, wh); // Keep latest
                }
                failureCounts.put(wh.UserId, failureCounts.get(wh.UserId) + 1);

                if (wh.Status == 'Password Lockout') {
                    lockedOutUserIds.add(wh.UserId);
                }
            }

            // Identify High Risk Users
            Set<Id> highRiskUserIds = new Set<Id>();
            for (Id uid : failureCounts.keySet()) {
                if (failureCounts.get(uid) > 5 || lockedOutUserIds.contains(uid)) {
                    highRiskUserIds.add(uid);
                }
            }

            // Fetch User Details for High Risk
            if (!highRiskUserIds.isEmpty()) {
                Map<Id, User> userMap = new Map<Id, User>([SELECT Id, Name FROM User WHERE Id IN :highRiskUserIds]);
                
                for (Id uid : highRiskUserIds) {
                    RiskyUserDetail detail = new RiskyUserDetail();
                    detail.userId = uid;
                    detail.userName = userMap.containsKey(uid) ? userMap.get(uid).Name : 'Unknown User';
                    detail.failureCount = failureCounts.get(uid);
                    detail.lastAttemptTime = lastAttemptMap.get(uid).LoginTime;
                    detail.ipAddress = lastAttemptMap.get(uid).SourceIp;

                    if (lockedOutUserIds.contains(uid)) {
                        detail.issueType = 'Account Locked';
                    } else {
                        detail.issueType = 'Potential Brute Force';
                    }
                    
                    result.riskyUsers.add(detail);
                }
            }
            // Count for badge
            result.potentialBruteForceCount = result.riskyUsers.size();


            // 2. Aggregate Login Locations (Last 24 Hours)
            List<LoginHistory> recentSuccess = [
                SELECT LoginGeo.City, LoginGeo.Country, Status 
                FROM LoginHistory 
                WHERE LoginTime >= :last24h 
                AND LoginGeoId != null
                LIMIT 1000
            ];

            Map<String, Integer> locationCounts = new Map<String, Integer>();
            
            for(LoginHistory lh : recentSuccess) {
                // Filter for Success in Apex
                if (lh.Status != 'Success') {
                    continue;
                }
                String city = lh.LoginGeo.City;
                String country = lh.LoginGeo.Country;
                
                if(city != null && country != null) {
                    String key = city + '##' + country;
                    if(!locationCounts.containsKey(key)) {
                        locationCounts.put(key, 0);
                    }
                    locationCounts.put(key, locationCounts.get(key) + 1);
                }
            }
            
            result.loginLocations = new List<LoginLocationWrapper>();
            for(String key : locationCounts.keySet()) {
                List<String> parts = key.split('##');
                LoginLocationWrapper loc = new LoginLocationWrapper();
                loc.city = parts[0];
                loc.country = parts[1];
                loc.count = locationCounts.get(key);
                result.loginLocations.add(loc);
            }

        } catch (Exception e) {
            System.debug('Error in getLoginRisks: ' + e.getMessage());
            // Fail gracefully, return 0s
        }
        
        return result;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<CriticalLogWrapper> getCriticalAuditLogs() {
        List<CriticalLogWrapper> logs = new List<CriticalLogWrapper>();
        
        try {
            DateTime yesterday = DateTime.now().addDays(-1);
            
            // ---------------------------------------------------------
            // SOURCE 1: Direct Permission Set Assignments (The "Who got access" check)
            // ---------------------------------------------------------
            List<PermissionSetAssignment> riskyAssignments = [
                SELECT Id, AssigneeId, Assignee.Name, Assignee.Title, Assignee.UserRole.Name, Assignee.IsActive, Assignee.Manager.Name,
                       PermissionSet.Label, PermissionSet.Name, SystemModstamp, PermissionSetId,
                       PermissionSet.IsOwnedByProfile, PermissionSet.Profile.Name, PermissionSet.ProfileId,
                       PermissionSet.PermissionsModifyAllData, 
                       PermissionSet.PermissionsCustomizeApplication, 
                       PermissionSet.PermissionsManageUsers,
                       PermissionSet.PermissionsViewAllData
                FROM PermissionSetAssignment 
                WHERE SystemModstamp >= :yesterday
                AND (
                    PermissionSet.PermissionsModifyAllData = true OR 
                    PermissionSet.PermissionsCustomizeApplication = true OR 
                    PermissionSet.PermissionsManageUsers = true OR
                    PermissionSet.PermissionsViewAllData = true
                )
                ORDER BY SystemModstamp DESC LIMIT 50
            ];

            for(PermissionSetAssignment psa : riskyAssignments) {
                CriticalLogWrapper w = new CriticalLogWrapper();
                w.id = psa.Id;
                w.action = 'Risky Assignment'; 
                w.operation = 'Assigned to ' + psa.Assignee.Name; 
                w.display = w.operation; 
                w.createdBy = 'System/Admin'; 
                w.createdDate = psa.SystemModstamp;
                w.section = 'Risk Audit';
                
                // Populate Extended Assignee Details
                w.assigneeId = psa.AssigneeId;
                w.assigneeName = psa.Assignee.Name;
                w.assigneeTitle = psa.Assignee.Title;
                w.assigneeRole = psa.Assignee.UserRole.Name;
                w.assigneeActive = psa.Assignee.IsActive;
                w.assigneeManager = psa.Assignee.Manager.Name;

                // Distinguish between pure Permission Sets and Profiles
                if (psa.PermissionSet.IsOwnedByProfile) {
                    w.type = 'Profile';
                    w.target = (psa.PermissionSet.Profile.Name != null) ? psa.PermissionSet.Profile.Name : psa.PermissionSet.Label;
                    w.targetId = psa.PermissionSet.ProfileId; // Link to Profile
                } else {
                    w.type = 'Perm Set';
                    w.target = psa.PermissionSet.Label;
                    w.targetId = psa.PermissionSetId; // Link to Perm Set
                }
                
                // Identify specifically WHY this was flagged
                List<String> r = new List<String>();
                if (psa.PermissionSet.PermissionsModifyAllData) r.add('Modify All Data');
                if (psa.PermissionSet.PermissionsViewAllData) r.add('View All Data');
                if (psa.PermissionSet.PermissionsCustomizeApplication) r.add('Customize Application');
                if (psa.PermissionSet.PermissionsManageUsers) r.add('Manage Users');
                w.riskList = r;
                
                logs.add(w);
            }

            // ---------------------------------------------------------
            // SOURCE 2: Setup Audit Trail (The "Who changed definitions" check)
            // ---------------------------------------------------------
            List<SetupAuditTrail> rawTrail = [SELECT Id, Action, Section, Display, CreatedBy.Name, CreatedDate 
                                           FROM SetupAuditTrail 
                                           WHERE CreatedDate >= :yesterday 
                                           ORDER BY CreatedDate DESC LIMIT 1000];

            for(SetupAuditTrail t : rawTrail) {
                Boolean isMatch = false;
                
                String fullText = ((t.Action != null ? t.Action : '') + ' ' + (t.Display != null ? t.Display : '')).toLowerCase();
                
                if (fullText.contains('modify all data') || fullText.contains('modifyalldata') ||
                    fullText.contains('view all data') || fullText.contains('viewalldata') ||
                    fullText.contains('customize application') || fullText.contains('customizeapplication') ||
                    (fullText.contains('manage users') && !t.Section.equals('Manage Users'))) { 
                    isMatch = true;
                }
                
                if (fullText.contains('system administrator')) {
                    isMatch = true;
                }

                if (isMatch) {
                    CriticalLogWrapper w = new CriticalLogWrapper();
                    w.id = t.Id;
                    w.action = t.Action;
                    w.display = t.Display;
                    w.createdBy = (t.CreatedBy != null) ? t.CreatedBy.Name : 'System';
                    w.createdDate = t.CreatedDate;
                    w.section = t.Section;
                    w.riskList = new List<String>(); // Initialize to empty list

                    // Parsing Logic
                    String disp = (t.Display != null) ? t.Display : '';
                    w.target = t.Section; 
                    w.operation = disp;
                    w.type = t.Section;

                    if (disp.contains(':')) {
                        List<String> parts = disp.split(':');
                        if(parts.size() >= 2) {
                            w.target = parts[0].trim();
                            w.operation = parts[1].trim(); 
                        }
                    }
                    
                    if(w.target != null) {
                        if(w.target.startsWithIgnoreCase('Permission set ')) {
                            w.target = w.target.removeStartIgnoreCase('Permission set ').trim();
                            w.type = 'Perm Set';
                        } else if(w.target.startsWithIgnoreCase('Changed profile ')) {
                            w.target = w.target.removeStartIgnoreCase('Changed profile ').trim();
                            w.type = 'Profile';
                        } else if(w.target.startsWithIgnoreCase('Changed permission set ')) {
                             w.target = w.target.removeStartIgnoreCase('Changed permission set ').trim();
                             w.type = 'Perm Set';
                        }
                    }
                    
                    logs.add(w);
                }
            }
            // Sort by date desc (simple bubble sort for small list)
            // ... omitting complex sort to keep it simple, they are appended.
            
        } catch (Exception e) {
             System.debug('Error fetching audit logs: ' + e.getMessage());
        }
        return logs;
    }

    @AuraEnabled
    public static SecurityScoreWrapper getSecurityScore() {
        SecurityScoreWrapper result = new SecurityScoreWrapper();
        try {
            // SecurityHealthCheck is a Tooling API object, so it requires an HTTP Callout
            String query = 'SELECT Score FROM SecurityHealthCheck LIMIT 1';
            String endpoint = URL.getOrgDomainUrl().toExternalForm() 
                              + '/services/data/v65.0/tooling/query?q=' + EncodingUtil.urlEncode(query, 'UTF-8');
            
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('GET');
            
            // LWC Session ID hack: Use VF page to get a full API-capable session ID
            // Note: This requires the AdminSessionHelper VF page to be deployed.
            String sessionId = '';
            if (!Test.isRunningTest()) {
                 try {
                     PageReference pr = new PageReference('/apex/AdminSessionHelper');
                     sessionId = pr.getContent().toString().trim();
                 } catch(Exception e) {
                     System.debug('Failed to get session from VF: ' + e.getMessage());
                     sessionId = UserInfo.getSessionId(); 
                 }
            } else {
                 sessionId = 'TEST_SESSION_ID';
            }
            
            req.setHeader('Authorization', 'Bearer ' + sessionId);
            req.setHeader('Content-Type', 'application/json');
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 200) {
                // Parse JSON response: {"size":1,"totalSize":1,"done":true,"queryLocator":null,"entityTypeName":"SecurityHealthCheck","records":[{"attributes":{"type":"SecurityHealthCheck","url":"..."},"Score":92}]}
                Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                List<Object> records = (List<Object>) jsonResponse.get('records');
                
                if (!records.isEmpty()) {
                    Map<String, Object> record = (Map<String, Object>) records[0];
                    result.score = Integer.valueOf(record.get('Score'));
                    
                    if (result.score >= 90) {
                        result.status = 'Excellent';
                    } else if (result.score >= 80) {
                        result.status = 'Good';
                    } else if (result.score >= 70) {
                        result.status = 'Fair';
                    } else {
                        result.status = 'Prioritize'; 
                    }
                } else {
                    result.score = 0;
                    result.status = 'Run Health Check';
                }
            } else {
                result.score = 0;
                // Parse error body if possible
                try {
                    List<Object> errors = (List<Object>) JSON.deserializeUntyped(res.getBody());
                    if (!errors.isEmpty()) {
                        Map<String, Object> err = (Map<String, Object>) errors[0];
                        result.status = 'Err: ' + (String)err.get('message');
                    } else {
                         result.status = 'Err API: ' + res.getStatus();
                    }
                } catch(Exception e) {
                    result.status = 'Err API (' + res.getStatusCode() + '): ' + res.getStatus();
                }
            }
        } catch (Exception e) {
            System.debug('Error fetching security score: ' + e.getMessage());
            result.score = 0;
            result.status = 'Err: ' + e.getMessage(); 
        }
        return result;
    }
    @AuraEnabled
    public static void resetUserPassword(String userId) {
        try {
            System.resetPassword(userId, true);
        } catch (Exception e) {
            throw new AuraHandledException('Error resetting password: ' + e.getMessage());
        }
    }
}