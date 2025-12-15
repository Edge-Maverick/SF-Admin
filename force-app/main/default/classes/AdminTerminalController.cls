public with sharing class AdminTerminalController {
    
    public class TerminalResponse {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public String outputType; // TEXT, TABLE, JSON
        @AuraEnabled public Object data;

        public TerminalResponse(Boolean success, String message, String outputType, Object data) {
            this.success = success;
            this.message = message;
            this.outputType = outputType;
            this.data = data;
        }
    }

    @AuraEnabled
    public static TerminalResponse executeCommand(String command) {
        try {
            String cleanCmd = command.trim();
            
            // 1. Check for SOQL (Pass-through)
            if (Pattern.matches('(?i)^SELECT\\s+.*', cleanCmd)) {
                return executeSOQL(cleanCmd);
            }

            // 2. Check for "Freezing User"
            // Usage: "freeze user [Name]"
            Matcher freezeMatcher = Pattern.compile('(?i)freeze\\s+(?:user\\s+)?([a-zA-Z0-9\\s]+)').matcher(cleanCmd);
            if (freezeMatcher.matches()) {
                String userName = freezeMatcher.group(1);
                return freezeUser(userName);
            }
            
            // 3. Check for "Unfreezing User"
            // Usage: "unfreeze user [Name]"
            Matcher unfreezeMatcher = Pattern.compile('(?i)unfreeze\\s+(?:user\\s+)?([a-zA-Z0-9\\s]+)').matcher(cleanCmd);
            if (unfreezeMatcher.matches()) {
                String userName = unfreezeMatcher.group(1);
                return unfreezeUser(userName);
            }

            // 4. Check for "Show Users"
            // Usage: "show users" or "list users"
            if (Pattern.matches('(?i)(show|list)\\s+users.*', cleanCmd)) {
                return executeSOQL('SELECT Id, Name, Username, IsActive, LastLoginDate FROM User ORDER BY LastLoginDate DESC LIMIT 10');
            }
            
            // 5. Check for "Unlock User"
            // Usage: "unlock user [Name]"
            Matcher unlockMatcher = Pattern.compile('(?i)unlock\\s+(?:user\\s+)?([a-zA-Z0-9\\s]+)').matcher(cleanCmd);
            if (unlockMatcher.matches()) {
                String userName = unlockMatcher.group(1);
                return unlockUser(userName);
            }

            // 6. Check for "Reset Password"
            // Usage: "reset password [Name]"
            Matcher resetPwdMatcher = Pattern.compile('(?i)reset\\s+password\\s+(?:for\\s+)?([a-zA-Z0-9\\s]+)').matcher(cleanCmd);
            if (resetPwdMatcher.matches()) {
                String userName = resetPwdMatcher.group(1);
                return resetPassword(userName);
            }

            // 7. Check for "Assign Permission Set"
            // Usage: "assign [PermSet] to [User]"
            Matcher assignPermMatcher = Pattern.compile('(?i)assign\\s+([a-zA-Z0-9\\s]+?)\\s+to\\s+([a-zA-Z0-9\\s]+)').matcher(cleanCmd);
            if (assignPermMatcher.matches()) {
                String permName = assignPermMatcher.group(1);
                String userName = assignPermMatcher.group(2);
                return assignPermSet(permName, userName);
            }

            // 8. Check for "Org Limits"
            // Usage: "limits"
            if (Pattern.matches('(?i)(show\\s+)?limits', cleanCmd)) {
                return getOrgLimits();
            }

            // 9. Check for "Cancel All Jobs"
            // Usage: "cancel all jobs"
            if (Pattern.matches('(?i)cancel\\s+all\\s+jobs', cleanCmd)) {
                return cancelAllJobs();
            }

            // 10. Check for "Describe Object"
            // Usage: "describe [Object]"
            Matcher descMatcher = Pattern.compile('(?i)describe\\s+([a-zA-Z0-9_]+)').matcher(cleanCmd);
            if (descMatcher.matches()) {
                return describeObject(descMatcher.group(1));
            }

            // 11. Check for "Whois ID"
            // Usage: "whois [Id]"
            Matcher whoisMatcher = Pattern.compile('(?i)whois\\s+([a-zA-Z0-9]{15,18})').matcher(cleanCmd);
            if (whoisMatcher.matches()) {
                return identifyId(whoisMatcher.group(1));
            }

            // 12. Check for "Recent Logs"
            // Usage: "logs" or "show logs"
            if (Pattern.matches('(?i)(show\\s+)?logs', cleanCmd)) {
                return getRecentLogs();
            }

            // 13. Check for "Quick Create"
            // Usage: "create [Object] [Name]"
            Matcher createMatcher = Pattern.compile('(?i)create\\s+([a-zA-Z0-9_]+)\\s+(.*)').matcher(cleanCmd);
            if (createMatcher.matches()) {
                String objType = createMatcher.group(1);
                String name = createMatcher.group(2).removeStart('"').removeEnd('"'); // Basic quote removal
                return quickCreate(objType, name);
            }

            // 14. Check for "Search" (Lowest priority)
            // Usage: "search [Term]"
            Matcher searchMatcher = Pattern.compile('(?i)search\\s+(.*)').matcher(cleanCmd);
            if (searchMatcher.matches()) {
                String term = searchMatcher.group(1);
                return executeSOSL(term);
            }

            // 15. Check for "Login As"
            // Usage: "login as [User]"
            Matcher loginMatcher = Pattern.compile('(?i)login\\s+as\\s+([a-zA-Z0-9\\s]+)').matcher(cleanCmd);
            if (loginMatcher.matches()) {
                return getLoginUrl(loginMatcher.group(1));
            }

            // 16. Check for "Count"
            // Usage: "count [Object]"
            Matcher countMatcher = Pattern.compile('(?i)count\\s+([a-zA-Z0-9_]+)').matcher(cleanCmd);
            if (countMatcher.matches()) {
                return countRecords(countMatcher.group(1));
            }

            // 17. Check for "Audit Privileges"
            // Usage: "audit privileges"
            if (Pattern.matches('(?i)audit\\s+privileges', cleanCmd)) {
                return auditPrivileges();
            }

            // 18. Check for "Check Permission"
            // Usage: "check perm [ApiName]"
            Matcher permMatcher = Pattern.compile('(?i)check\\s+perm\\s+([a-zA-Z0-9_]+)').matcher(cleanCmd);
            if (permMatcher.matches()) {
                return checkPermission(permMatcher.group(1));
            }

            return new TerminalResponse(false, 'Command not understood: ' + cleanCmd + '. Type "help" for a list of commands.', 'TEXT', null);

        } catch (Exception e) {
            return new TerminalResponse(false, 'Error: ' + e.getMessage(), 'TEXT', null);
        }
    }

    private static TerminalResponse executeSOQL(String query) {
        try {
            List<SObject> results = Database.query(query);
            if (results.isEmpty()) {
                return new TerminalResponse(true, 'No records found.', 'TEXT', null);
            }
            return new TerminalResponse(true, 'Query executed successfully.', 'TABLE', results);
        } catch (Exception e) {
            return new TerminalResponse(false, 'SOQL Error: ' + e.getMessage(), 'TEXT', null);
        }
    }
    
    private static TerminalResponse executeSOSL(String term) {
        try {
            String safeTerm = String.escapeSingleQuotes(term);
            String soslQuery = 'FIND \'' + safeTerm + '\' IN ALL FIELDS RETURNING Account(Name, Type), Contact(Name, Email), User(Name, Username)';
            List<List<SObject>> searchList = Search.query(soslQuery);
            
            List<SObject> flattened = new List<SObject>();
            for(List<SObject> subList : searchList) {
                flattened.addAll(subList);
            }

            if (flattened.isEmpty()) {
                return new TerminalResponse(true, 'No matching records found for "' + term + '".', 'TEXT', null);
            }
            return new TerminalResponse(true, 'Search completed.', 'TABLE', flattened);
        } catch (Exception e) {
            return new TerminalResponse(false, 'Search Error: ' + e.getMessage(), 'TEXT', null);
        }
    }

    private static TerminalResponse freezeUser(String nameOrId) {
        List<User> targetUsers = [SELECT Id, Name FROM User WHERE Name = :nameOrId OR Username = :nameOrId LIMIT 1];
        if (targetUsers.isEmpty()) {
            return new TerminalResponse(false, 'User not found: ' + nameOrId, 'TEXT', null);
        }
        
        Id userId = targetUsers[0].Id;
        List<UserLogin> logins = [SELECT Id, IsFrozen FROM UserLogin WHERE UserId = :userId LIMIT 1];
        
        if (logins.isEmpty()) {
             return new TerminalResponse(false, 'User Login record not found. User might be inactive or special type.', 'TEXT', null);
        }
        
        // Check if already frozen
        if(logins[0].IsFrozen) {
             return new TerminalResponse(true, 'User ' + targetUsers[0].Name + ' is already frozen.', 'TEXT', null);
        }

        logins[0].IsFrozen = true;
        update logins;
        
        return new TerminalResponse(true, 'Successfully froze user: ' + targetUsers[0].Name, 'TEXT', null);
    }
    
    private static TerminalResponse unfreezeUser(String nameOrId) {
        List<User> targetUsers = [SELECT Id, Name FROM User WHERE Name = :nameOrId OR Username = :nameOrId LIMIT 1];
        if (targetUsers.isEmpty()) {
            return new TerminalResponse(false, 'User not found: ' + nameOrId, 'TEXT', null);
        }
        
        Id userId = targetUsers[0].Id;
        List<UserLogin> logins = [SELECT Id, IsFrozen FROM UserLogin WHERE UserId = :userId LIMIT 1];
        
        if (logins.isEmpty()) {
             return new TerminalResponse(false, 'User Login record not found.', 'TEXT', null);
        }
        
        if(!logins[0].IsFrozen) {
             return new TerminalResponse(true, 'User ' + targetUsers[0].Name + ' is was not frozen.', 'TEXT', null);
        }

        logins[0].IsFrozen = false;
        update logins;
        
        return new TerminalResponse(true, 'Successfully unfroze user: ' + targetUsers[0].Name, 'TEXT', null);
    }

    private static TerminalResponse unlockUser(String nameOrId) {
        List<User> targetUsers = [SELECT Id, Name FROM User WHERE Name = :nameOrId OR Username = :nameOrId LIMIT 1];
        if (targetUsers.isEmpty()) {
            return new TerminalResponse(false, 'User not found: ' + nameOrId, 'TEXT', null);
        }
        
        Id userId = targetUsers[0].Id;
        List<UserLogin> logins = [SELECT Id, IsPasswordLocked FROM UserLogin WHERE UserId = :userId LIMIT 1];

        if (logins.isEmpty()) {
             return new TerminalResponse(false, 'User Login record not found.', 'TEXT', null);
        }

        if(!logins[0].IsPasswordLocked) {
             return new TerminalResponse(true, 'User ' + targetUsers[0].Name + ' is not locked.', 'TEXT', null);
        }

        logins[0].IsPasswordLocked = false;
        update logins;

        return new TerminalResponse(true, 'Successfully unlocked user: ' + targetUsers[0].Name, 'TEXT', null);
    }

    private static TerminalResponse resetPassword(String nameOrId) {
        List<User> targetUsers = [SELECT Id, Name FROM User WHERE Name = :nameOrId OR Username = :nameOrId LIMIT 1];
        if (targetUsers.isEmpty()) {
            return new TerminalResponse(false, 'User not found: ' + nameOrId, 'TEXT', null);
        }

        try {
            System.resetPassword(targetUsers[0].Id, true);
            return new TerminalResponse(true, 'Password reset email sent to ' + targetUsers[0].Name, 'TEXT', null);
        } catch(Exception e) {
            return new TerminalResponse(false, 'Failed to reset password: ' + e.getMessage(), 'TEXT', null);
        }
    }

    private static TerminalResponse assignPermSet(String permName, String userName) {
        List<PermissionSet> perms = [SELECT Id, Name, Label FROM PermissionSet WHERE Name = :permName OR Label = :permName LIMIT 1];
        if (perms.isEmpty()) {
            return new TerminalResponse(false, 'Permission Set not found: ' + permName, 'TEXT', null);
        }

        List<User> users = [SELECT Id, Name FROM User WHERE Name = :userName OR Username = :userName LIMIT 1];
        if (users.isEmpty()) {
            return new TerminalResponse(false, 'User not found: ' + userName, 'TEXT', null);
        }

        // Check existing
        List<PermissionSetAssignment> existing = [SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = :users[0].Id AND PermissionSetId = :perms[0].Id LIMIT 1];
        if (!existing.isEmpty()) {
            return new TerminalResponse(true, 'User ' + users[0].Name + ' already has permission set ' + perms[0].Label, 'TEXT', null);
        }

        PermissionSetAssignment psa = new PermissionSetAssignment(
            AssigneeId = users[0].Id,
            PermissionSetId = perms[0].Id
        );
        insert psa;

        return new TerminalResponse(true, 'Assigned "' + perms[0].Label + '" to ' + users[0].Name, 'TEXT', null);
    }

    private static TerminalResponse getOrgLimits() {
         Map<String, System.OrgLimit> limitsMap = OrgLimits.getMap();
         List<Map<String, Object>> limitsData = new List<Map<String, Object>>();

         for (String key : limitsMap.keySet()) {
             System.OrgLimit limitVal = limitsMap.get(key);
             Map<String, Object> limitInfo = new Map<String, Object>();
             limitInfo.put('Name', limitVal.getName());
             limitInfo.put('Value', limitVal.getValue());
             limitInfo.put('Limit', limitVal.getLimit());
             limitsData.add(limitInfo);
         }

         return new TerminalResponse(true, 'Org Limits Snapshot', 'TABLE', limitsData);
    }

    private static TerminalResponse cancelAllJobs() {
        // Safety: only cancel generic Apex jobs, batch, future, queueable
        List<AsyncApexJob> jobs = [SELECT Id, JobType, Status FROM AsyncApexJob WHERE Status IN ('Processing', 'Queued', 'Preparing') AND JobType IN ('BatchApex', 'Queueable', 'Future') LIMIT 50];
        
        if (jobs.isEmpty()) {
            return new TerminalResponse(true, 'No hanging jobs found to cancel.', 'TEXT', null);
        }

        for (AsyncApexJob job : jobs) {
            System.abortJob(job.Id);
        }

        return new TerminalResponse(true, 'Aborted ' + jobs.size() + ' jobs (Batch/Queueable/Future).', 'TEXT', null);
    }

    private static TerminalResponse describeObject(String objName) {
        SObjectType type = Schema.getGlobalDescribe().get(objName);
        if (type == null) {
            return new TerminalResponse(false, 'Object not found: ' + objName, 'TEXT', null);
        }

        List<Map<String, String>> fieldsData = new List<Map<String, String>>();
        Map<String, SObjectField> fieldMap = type.getDescribe().fields.getMap();
        
        // Limit to first 50 fields to avoid bombarding terminal
        Integer count = 0;
        for (String fieldName : fieldMap.keySet()) {
            if (count++ > 50) break;
            DescribeFieldResult dfr = fieldMap.get(fieldName).getDescribe();
            Map<String, String> fInfo = new Map<String, String>();
            fInfo.put('ValidApiName', dfr.getName());
            fInfo.put('Label', dfr.getLabel());
            fInfo.put('Type', String.valueOf(dfr.getType()));
            fieldsData.add(fInfo);
        }

        return new TerminalResponse(true, 'Fields for ' + objName + ' (Top 50)', 'TABLE', fieldsData);
    }

    private static TerminalResponse identifyId(String idVal) {
        try {
            Id myId = (Id)idVal;
            String sObjName = myId.getSObjectType().getDescribe().getName();
            return new TerminalResponse(true, 'ID ' + idVal + ' belongs to Object: ' + sObjName, 'TEXT', null);
        } catch(Exception e) {
            return new TerminalResponse(false, 'Invalid ID: ' + idVal, 'TEXT', null);
        }
    }

    private static TerminalResponse getRecentLogs() {
        List<ApexLog> logs = [SELECT Id, LogUser.Name, Operation, Status, DurationMilliseconds, StartTime FROM ApexLog ORDER BY StartTime DESC LIMIT 20];
         if (logs.isEmpty()) {
            return new TerminalResponse(true, 'No recent debug logs found.', 'TEXT', null);
        }
        return new TerminalResponse(true, 'Last 20 Debug Logs', 'TABLE', logs);
    }

    private static TerminalResponse quickCreate(String objType, String nameVal) {
         SObjectType type = Schema.getGlobalDescribe().get(objType);
        if (type == null) {
            return new TerminalResponse(false, 'Object not found: ' + objType, 'TEXT', null);
        }

        try {
            SObject newObj = type.newSObject();
            newObj.put('Name', nameVal); // Limitation: Assumes Name field exists
            insert newObj;
            return new TerminalResponse(true, 'Created ' + objType + ': ' + newObj.Id, 'TEXT', null);
        } catch(Exception e) {
             return new TerminalResponse(false, 'Failed to create record: ' + e.getMessage(), 'TEXT', null);
        }
    }

    private static TerminalResponse getLoginUrl(String nameOrId) {
        List<User> users = [SELECT Id, Name FROM User WHERE Name = :nameOrId OR Username = :nameOrId LIMIT 1];
        if (users.isEmpty()) {
            return new TerminalResponse(false, 'User not found: ' + nameOrId, 'TEXT', null);
        }
        
        // Construct Login As URL
        String orgId = UserInfo.getOrganizationId();
        String userId = users[0].Id;
        String url = '/servlet/servlet.su?oid=' + orgId + '&suorgadminid=' + userId + '&retURL=%2F&targetURL=%2F';
        
        return new TerminalResponse(true, 'Logging in as ' + users[0].Name + '...', 'LOGIN', url);
    }

    private static TerminalResponse countRecords(String objName) {
        try {
            String query = 'SELECT Count() FROM ' + String.escapeSingleQuotes(objName);
            Integer count = Database.countQuery(query);
            return new TerminalResponse(true, 'Count of ' + objName + ': ' + count, 'TEXT', null);
        } catch(Exception e) {
             return new TerminalResponse(false, 'Count failed: ' + e.getMessage(), 'TEXT', null);
        }
    }

    private static TerminalResponse auditPrivileges() {
        // Critical permissions to check
        List<String> criticalPerms = new List<String>{
            'PermissionsModifyAllData', 
            'PermissionsViewAllData', 
            'PermissionsManageUsers', 
            'PermissionsCustomizeApplication'
        };

        // Output list
        List<Map<String, Object>> summary = new List<Map<String, Object>>();

        try {
            for(String perm : criticalPerms) {
                // Must use dynamic SOQL for permissions as field existence depends on Org features (usually safely present though)
                String query = 'SELECT Count(AssigneeId) c FROM PermissionSetAssignment WHERE PermissionSet.' + perm + ' = true';
                // Note: This counts assignments. A user might be assigned multiple times (via different perm sets).
                // Improvements: Using AggregateResult on AssigneeId implies GROUP BY.
                // Let's do a slightly cleaner approach: Count Distinct Users.
                query = 'SELECT Count_Distinct(AssigneeId) c FROM PermissionSetAssignment WHERE PermissionSet.' + perm + ' = true';
                
                AggregateResult ar = Database.query(query);
                Integer count = (Integer)ar.get('c');
                
                Map<String, Object> row = new Map<String, Object>();
                row.put('Permission', perm.removeStart('Permissions'));
                row.put('User Count', count);
                row.put('Risk Level', 'High');
                summary.add(row);
            }
            return new TerminalResponse(true, 'Privileged User Audit', 'TABLE', summary);
        } catch(Exception e) {
             return new TerminalResponse(false, 'Audit failed: ' + e.getMessage(), 'TEXT', null);
        }
    }

    private static TerminalResponse checkPermission(String permApiName) {
        try {
            // Sanitize
            String safePerm = String.escapeSingleQuotes(permApiName);
            if (!safePerm.startsWith('Permissions')) {
                // Try to be helpful if they typed "ModifyAllData"
                safePerm = 'Permissions' + safePerm;
            }

            String query = 'SELECT Assignee.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile FROM PermissionSetAssignment WHERE PermissionSet.' + safePerm + ' = true LIMIT 50';
            
            List<PermissionSetAssignment> assignments = Database.query(query);
            
            if (assignments.isEmpty()) {
                return new TerminalResponse(true, 'No users found with permission: ' + safePerm, 'TEXT', null);
            }

            List<Map<String, Object>> results = new List<Map<String, Object>>();
            for(PermissionSetAssignment psa : assignments) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('User', psa.Assignee.Name);
                row.put('Source', psa.PermissionSet.IsOwnedByProfile ? 'Profile' : 'PermSet');
                row.put('Source Name', psa.PermissionSet.Label);
                results.add(row);
            }

            return new TerminalResponse(true, 'Users with ' + safePerm, 'TABLE', results);

        } catch(Exception e) {
             return new TerminalResponse(false, 'Check failed. Verify permission API name (e.g. PermissionsModifyAllData). Error: ' + e.getMessage(), 'TEXT', null);
        }
    }
}

