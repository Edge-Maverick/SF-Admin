public with sharing class OrgOverviewController {
    
    @AuraEnabled
    public static HomeDetailsWrapper getHomeDetails(){
        try {
            HomeDetailsWrapper homeDetails = new HomeDetailsWrapper();
            homeDetails.currentUser = getUserDetails();
            homeDetails.currentOrgInfo = getOrganizationDetails();
            return homeDetails;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Organization getOrganizationDetails() {
        return [SELECT Id, Name, OrganizationType, InstanceName, IsSandbox FROM Organization LIMIT 1];
    }

    public static User getUserDetails(){
        return [SELECT Id,Username,Name, FirstName, LastName, Email, Profile.Name FROM User WHERE Id = :UserInfo.getUserId()];
    }
    
    @AuraEnabled(cacheable=true)
    public static LicenseUtilizationHelper.LicenseUtilizationWrapper getLicenseUtilization(){
        try {
            LicenseUtilizationHelper luw = new LicenseUtilizationHelper('License Utilization');
            return luw.getLicenseUtilization();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static ReleaseInfo getUpcomingRelease() {
        Organization org = [SELECT InstanceName FROM Organization LIMIT 1];
        String instanceName = org.InstanceName;
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.status.salesforce.com/v1/maintenances?instance=' + instanceName + '&limit=1000&offset=0');
        req.setMethod('GET');
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() == 200) {
            List<Object> maintenances = (List<Object>) JSON.deserializeUntyped(res.getBody());
            for (Object obj : maintenances) {
                Map<String, Object> m = (Map<String, Object>) obj;
                String releaseType = (String) m.get('releaseType');
                Boolean isCore = (Boolean) m.get('isCore');
                String plannedStartTimeStr = (String) m.get('plannedStartTime');
                
                if ('Major'.equalsIgnoreCase(releaseType) && isCore == true) {
                    DateTime plannedStartTime = (DateTime) JSON.deserialize('"' + plannedStartTimeStr + '"', DateTime.class);
                    if (plannedStartTime > DateTime.now()) {
                        ReleaseInfo info = new ReleaseInfo();
                        info.name = (String) m.get('name');
                        info.releaseDate = plannedStartTime.date();
                        info.daysRemaining = Date.today().daysBetween(info.releaseDate);
                        
                        if (info.daysRemaining <= 60) {
                            return info;
                        }
                    }
                }
            }
        }
        return null;
    }

    // --- Sticky Note Methods ---
    @AuraEnabled
    public static List<Admin_Note__c> getStickyNotes() {
        return [SELECT Id, Note_Content__c, CreatedDate, CreatedBy.Name 
                FROM Admin_Note__c 
                ORDER BY CreatedDate DESC];
    }

    @AuraEnabled
    public static Admin_Note__c saveStickyNote(String content) {
        Admin_Note__c note = new Admin_Note__c(Note_Content__c = content);
        insert note;
        return note;
    }

    @AuraEnabled
    public static void deleteStickyNote(String noteId) {
        delete [SELECT Id FROM Admin_Note__c WHERE Id = :noteId];
    }

    // --- Trust API Methods ---
    @AuraEnabled(cacheable=true)
    public static TrustInfoWrapper getTrustInfo() {
        TrustInfoWrapper wrapper = new TrustInfoWrapper();
        wrapper.activeIncidents = new List<IncidentInfo>();
        wrapper.pastIncidents = new List<IncidentInfo>();
        
        try {
            Organization org = [SELECT InstanceName FROM Organization LIMIT 1];
            String instanceName = org.InstanceName;
            
            Http http = new Http();

            // 1. Get Instance Status (Version, API Level, Active Incidents)
            HttpRequest statusReq = new HttpRequest();
            statusReq.setEndpoint('https://api.status.salesforce.com/v1/instances/' + instanceName + '/status');
            statusReq.setMethod('GET');
            
            HttpResponse statusRes = http.send(statusReq);
            
            if (statusRes.getStatusCode() == 200) {
                Map<String, Object> statusMap = (Map<String, Object>) JSON.deserializeUntyped(statusRes.getBody());
                wrapper.releaseVersion = (String) statusMap.get('releaseVersion');
                wrapper.releaseNumber = (String) statusMap.get('releaseNumber');
                wrapper.apiLevel = calculateApiVersion(wrapper.releaseVersion);
                
                // Active Incidents from /status
                List<Object> statusIncidents = (List<Object>) statusMap.get('Incidents');
                if (statusIncidents != null) {
                    for (Object obj : statusIncidents) {
                        Map<String, Object> m = (Map<String, Object>) obj;
                        String status = (String) m.get('status');
                        
                        // Filter out resolved incidents
                        if ('Resolved'.equalsIgnoreCase(status) || 'Completed'.equalsIgnoreCase(status)) {
                            continue;
                        }

                        IncidentInfo info = new IncidentInfo();
                        info.id = String.valueOf(m.get('id'));
                        
                        Object msgObj = m.get('message');
                        if (msgObj instanceof Map<String, Object>) {
                             List<Object> events = (List<Object>) m.get('IncidentEvents');
                             if (events != null && !events.isEmpty()) {
                                 Map<String, Object> latestEvent = (Map<String, Object>) events[0];
                                 info.message = (String) latestEvent.get('message');
                             } else {
                                 info.message = 'See Trust for details';
                             }
                        } else {
                            info.message = (String) msgObj;
                        }
                        
                        wrapper.activeIncidents.add(info);
                    }
                }
            } else {
                wrapper.releaseVersion = 'Error: ' + statusRes.getStatusCode();
            }
            
            HttpRequest incReq = new HttpRequest();
            incReq.setEndpoint('https://api.status.salesforce.com/v1/incidents?instance=' + instanceName + '&limit=10');
            incReq.setMethod('GET');
            HttpResponse incRes = http.send(incReq);
            
            if (incRes.getStatusCode() == 200) {
                List<Object> incidents = (List<Object>) JSON.deserializeUntyped(incRes.getBody());
                for (Object obj : incidents) {
                    Map<String, Object> m = (Map<String, Object>) obj;
                    IncidentInfo info = new IncidentInfo();
                    info.id = String.valueOf(m.get('id'));
                    
                    Object msgObj = m.get('message');
                    if (msgObj instanceof Map<String, Object>) {
                         List<Object> events = (List<Object>) m.get('IncidentEvents');
                         if (events != null && !events.isEmpty()) {
                             Map<String, Object> latestEvent = (Map<String, Object>) events[0];
                             info.message = (String) latestEvent.get('message');
                         } else {
                             info.message = 'See Trust for details';
                         }
                    } else {
                        info.message = (String) msgObj;
                    }
                    
                    info.serviceKeys = (List<Object>) m.get('serviceKeys');
                    info.createdAt = (String) m.get('createdAt');
                    wrapper.pastIncidents.add(info);
                }
                wrapper.pastIncidents.sort();
            }

            // 3. Get Next Maintenance (Major)
            HttpRequest maintReq = new HttpRequest();
            maintReq.setEndpoint('https://api.status.salesforce.com/v1/maintenances?instance=' + instanceName + '&limit=1000&offset=0');
            maintReq.setMethod('GET');
            HttpResponse maintRes = http.send(maintReq);

            if (maintRes.getStatusCode() == 200) {
                List<Object> maintenances = (List<Object>) JSON.deserializeUntyped(maintRes.getBody());
                for (Object obj : maintenances) {
                    Map<String, Object> m = (Map<String, Object>) obj;
                    String releaseType = (String) m.get('releaseType');
                    
                    if ('Major'.equalsIgnoreCase(releaseType)) {
                        String plannedStartTimeStr = (String) m.get('plannedStartTime');
                        DateTime plannedStartTime = (DateTime) JSON.deserialize('"' + plannedStartTimeStr + '"', DateTime.class);
                        
                        if (plannedStartTime > DateTime.now()) {
                            wrapper.nextReleaseName = (String) m.get('name');
                            wrapper.nextReleaseDate = plannedStartTime.date();
                            break; // Found the next one
                        }
                    }
                }
            }
        } catch (Exception e) {
            wrapper.releaseVersion = 'Exception: ' + e.getMessage();
            System.debug('Trust API Error: ' + e.getMessage());
        }

        return wrapper;
    }

    private static String calculateApiVersion(String releaseString) {
        if (String.isBlank(releaseString)) return 'Unknown';
        
        try {
            List<String> parts = releaseString.split(' ');
            if (parts.size() < 2) return 'Unknown';

            String season = parts[0];       
            String yearStr = parts[1];      

            if (!yearStr.startsWith('\'')) return 'Unknown';
            Integer year = Integer.valueOf(yearStr.substring(1)); 

            Integer yearDiff = year - 11;
            
            Integer baseVersion;
            if (season.equalsIgnoreCase('Winter')) {
                baseVersion = 20;
            } else if (season.equalsIgnoreCase('Spring')) {
                baseVersion = 21;
            } else if (season.equalsIgnoreCase('Summer')) {
                baseVersion = 22;
            } else {
                return 'Unknown'; 
            }

            Integer calculatedVersion = baseVersion + (yearDiff * 3);
            return calculatedVersion + '.0';

        } catch (Exception e) {
            System.debug('Error calculating API Version: ' + e.getMessage());
            return 'Unknown';
        }
    }

    // --- Inner Classes ---
    public class HomeDetailsWrapper{
        @AuraEnabled public User currentUser;
        @AuraEnabled public Organization currentOrgInfo;
    }

    public class ReleaseInfo {
        @AuraEnabled public String name;
        @AuraEnabled public Date releaseDate;
        @AuraEnabled public Integer daysRemaining;
    }

    public class TrustInfoWrapper {
        @AuraEnabled public String releaseVersion;
        @AuraEnabled public String releaseNumber;
        @AuraEnabled public String apiLevel;
        @AuraEnabled public String nextReleaseName;
        @AuraEnabled public Date nextReleaseDate;
        @AuraEnabled public List<IncidentInfo> activeIncidents;
        @AuraEnabled public List<IncidentInfo> pastIncidents;
    }

    public class IncidentInfo implements Comparable {
        @AuraEnabled public String id;
        @AuraEnabled public String message;
        @AuraEnabled public List<Object> serviceKeys;
        @AuraEnabled public String createdAt;

        public Integer compareTo(Object compareTo) {
            IncidentInfo other = (IncidentInfo) compareTo;
            if (this.createdAt == other.createdAt) return 0;
            if (this.createdAt > other.createdAt) return -1;
            return 1;
        }
    }
}